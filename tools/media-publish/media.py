"""Local image generation, R2 storage and publication of selected journal posts."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import quote, urlsplit, urlunsplit

import image_api
import vk_publish

BUCKET = 'zerkalius-media'
PUBLIC_BASE = 'https://media.1001100.online'
REPOSITORY = Path(__file__).resolve().parents[2]
MAX_IMAGE_BYTES = 50 * 1024 * 1024


def emit(value):
    print(json.dumps(value, ensure_ascii=False, indent=2))


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()

    def text(self):
        return ' '.join(''.join(c.text() if isinstance(c, Node) else c for c in self.children).split())

    def has_class(self, name):
        return name in (self.attrs.get('class') or '').split()


class JournalParser(HTMLParser):
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def journal_cards(html, source_url):
    journal_url = urlsplit(source_url)
    if journal_url.scheme != 'https' or not journal_url.hostname or journal_url.username or journal_url.password or journal_url.query or journal_url.fragment:
        raise ValueError('Journal URL должен быть HTTPS URL без credentials, query и anchor.')
    parser = JournalParser()
    parser.feed(html)
    parser.close()
    cards, seen = [], set()
    for article in parser.root.walk():
        if article.tag != 'article' or not article.has_class('entry'):
            continue
        anchor = article.attrs.get('id')
        if not anchor:
            raise ValueError('У article.entry отсутствует id.')
        header = next((n for n in article.walk() if n.tag == 'header' and n.has_class('entry-heading')), None)
        if header is None:
            raise ValueError('У article.entry отсутствует entry-heading.')
        title = next((n.text() for n in header.walk() if n.tag == 'h2'), '')
        description = ' '.join(n.text() for n in header.children if isinstance(n, Node) and n.tag == 'p' and not n.has_class('entry-meta'))
        entry_url = urlunsplit((journal_url.scheme, journal_url.netloc, journal_url.path, '', quote(anchor, safe='')))
        for figure in article.walk():
            if figure.tag != 'figure':
                continue
            links = [n for n in figure.walk() if n.tag == 'a' and 'data-view-image' in n.attrs]
            if not links:
                continue
            # The journal can repeat the original and offer another size in
            # figcaption. The image-link wrapping img is the figure's card.
            primary_links = [n for n in links if n.has_class('image-link')
                             and any(child.tag == 'img' for child in n.walk())]
            if primary_links:
                links = primary_links
            links = list({n.attrs.get('href', ''): n for n in links}.values())
            if len(links) != 1:
                raise ValueError('Ожидалась одна исходная картинка на figure.')
            source = links[0].attrs.get('href', '')
            parsed = urlsplit(source)
            if parsed.scheme != 'https' or parsed.netloc != 'media.1001100.online' or not parsed.path or parsed.query or parsed.fragment:
                raise ValueError('Исходная картинка должна быть прямым HTTPS URL media.1001100.online без query/anchor.')
            name = next((n.text() for n in figure.walk() if n.has_class('figure-name')), '')
            alt = next((n.attrs.get('alt', '') for n in figure.walk() if n.tag == 'img'), '')
            stable_id = 'journal-' + hashlib.sha256((anchor + '\n' + source).encode('utf-8')).hexdigest()[:20]
            if stable_id in seen:
                continue
            seen.add(stable_id)
            caption = '\n\n'.join(s for s in (f'{title} · {name}' if name else title, description, entry_url) if s)
            cards.append(dict(id=stable_id, image_url=source, figure_name=name, image_description=alt,
                              source_title=title, source_description=description, journal_url=source_url,
                              entry_anchor=anchor, entry_url=entry_url, caption=caption, state='draft'))
    if not cards:
        raise ValueError('В журнале не найдены карточки figure a[data-view-image].')
    return cards


def prepare_vk(args):
    output = Path(args.output_directory).expanduser().resolve()
    # Resolve symlinks and junctions before checking the repository boundary.
    if output.is_relative_to(REPOSITORY):
        raise ValueError('Каталог черновиков должен находиться вне репозитория.')
    cards = journal_cards(Path(args.journal).read_text(encoding='utf-8-sig'), args.journal_url)
    # Refuse existing destination files: repeated preparation cannot replace edits.
    names = ['drafts.json', 'drafts.txt']
    if any((output / name).exists() for name in names):
        raise ValueError('drafts.json/txt уже существуют. Выберите новый каталог.')
    output.mkdir(parents=True, exist_ok=True)
    payload = dict(schema_version=1, state='draft', target_group_id=240613453, network_used=False, posting_performed=False,
                   source_file=str(Path(args.journal).resolve()), journal_url=args.journal_url, cards=cards)
    with (output / 'drafts.json').open('x', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    with (output / 'drafts.txt').open('x', encoding='utf-8') as handle:
        handle.write('Черновики для ручной подготовки VK. Публикации не было.\n\n')
        for card in cards:
            handle.write(f"[{card['id']}]\nКартинка: {card['image_url']}\n\n{card['caption']}\n\n{'=' * 40}\n\n")
    emit(dict(cards=len(cards), json=str(output / 'drafts.json'), text=str(output / 'drafts.txt'), posted=False))


def image_type(data):
    # Allow raster images only; SVG/HTML and unrecognised file types are rejected.
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return 'image/gif'
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        return 'image/webp'
    raise ValueError('Допустимы PNG, JPEG, GIF или WebP с подходящей сигнатурой.')


def network(args):
    try:
        import boto3
        from botocore.config import Config
        from botocore.exceptions import ClientError
    except ImportError:
        raise ValueError('Установите requirements.txt в частный venv по README.') from None
    endpoint = os.environ.get('ZERKALIUS_R2_ENDPOINT', '')
    if not re.fullmatch(r'https://[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com', endpoint):
        raise ValueError('Некорректный endpoint Cloudflare R2.')
    access_id = os.environ.get('ZERKALIUS_R2_ACCESS_ID', '')
    secret = os.environ.get('ZERKALIUS_R2_SECRET', '')
    if not access_id or not secret:
        raise ValueError('Нет credentials; используйте media.ps1 configure.')
    # Explicit credentials prevent fallback to unrelated AWS profiles or IMDS.
    client = boto3.client('s3', endpoint_url=endpoint, aws_access_key_id=access_id,
                          aws_secret_access_key=secret, region_name='auto',
                          config=Config(signature_version='s3v4', connect_timeout=10, read_timeout=60,
                                        retries={'mode': 'standard', 'max_attempts': 2},
                                        s3={'addressing_style': 'path'}))
    try:
        if args.command == 'list':
            # One bounded read, with cursor rather than implicitly listing everything.
            response = client.list_objects_v2(Bucket=BUCKET, Prefix=args.prefix, MaxKeys=100)
            emit(dict(bucket=BUCKET, objects=[dict(key=x['Key'], size=x['Size'], etag=x['ETag'])
                                             for x in response.get('Contents', [])],
                      truncated=response.get('IsTruncated', False),
                      next_token=response.get('NextContinuationToken')))
            return
        path = Path(args.file).expanduser().resolve(strict=True)
        if not path.is_file() or not 0 < path.stat().st_size <= MAX_IMAGE_BYTES:
            raise ValueError('Нужен обычный непустой файл изображения не более 50 МиБ.')
        key = args.key
        if not key or len(key.encode('utf-8')) > 1024 or key.startswith('/') or '\\' in key or any(p in ('', '.', '..') for p in key.split('/')) or any(ord(c) < 32 or ord(c) == 127 for c in key):
            raise ValueError('Нужен явный относительный object key без пустых частей, .., backslash и управляющих символов.')
        data = path.read_bytes()
        if not 0 < len(data) <= MAX_IMAGE_BYTES:
            raise ValueError('Размер файла изменился или превышает 50 МиБ.')
        content_type = image_type(data)
        digest = hashlib.sha256(data).hexdigest()
        # HEAD is advisory; the conditional PUT also closes a concurrent-write race.
        try:
            client.head_object(Bucket=BUCKET, Key=key)
        except ClientError as exc:
            if str(exc.response.get('Error', {}).get('Code')) not in ('404', 'NoSuchKey', 'NotFound'):
                raise
        else:
            raise ValueError('Объект уже существует. Перезапись запрещена; выберите новый key.')
        operation = client.meta.service_model.operation_model('PutObject')
        if 'IfNoneMatch' not in operation.input_shape.members:
            raise ValueError('boto3 не поддерживает условный PUT. Обновите зависимости; загрузка отменена.')
        client.put_object(Bucket=BUCKET, Key=key, Body=data, ContentLength=len(data),
                          ContentType=content_type, Metadata={'sha256': digest}, IfNoneMatch='*')
        emit(dict(bucket=BUCKET, key=key, public_url=PUBLIC_BASE + '/' + quote(key, safe='/'),
                  sha256=digest, bytes=len(data), content_type=content_type))
    except ClientError as exc:
        # Never print SDK exception strings: they can contain request details.
        code = str(exc.response.get('Error', {}).get('Code', 'unknown'))
        status = exc.response.get('ResponseMetadata', {}).get('HTTPStatusCode')
        safe_code = code if re.fullmatch(r'[A-Za-z0-9_.-]{1,80}', code) else 'unknown'
        raise ValueError(f'R2 отказ: {safe_code}; HTTP {status}. Изменения не подтверждены.') from None
    finally:
        client.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    read = commands.add_parser('list')
    read.add_argument('--prefix', default='')
    upload = commands.add_parser('upload')
    upload.add_argument('--file', required=True)
    upload.add_argument('--key', required=True)
    draft = commands.add_parser('prepare-vk')
    draft.add_argument('--journal', required=True)
    draft.add_argument('--output-directory', required=True)
    draft.add_argument('--journal-url', required=True)
    image_api.add_arguments(commands.add_parser('generate-image'))
    commands.add_parser('check-vk')
    release = commands.add_parser('publish-vk')
    release.add_argument('--queue', required=True)
    args = parser.parse_args()
    try:
        if args.command == 'prepare-vk':
            prepare_vk(args)
        elif args.command == 'generate-image':
            emit(image_api.generate(args, REPOSITORY, image_type, MAX_IMAGE_BYTES))
        elif args.command == 'check-vk':
            emit(vk_publish.check())
        elif args.command == 'publish-vk':
            journal = REPOSITORY / 'issledovanie/image-journal/index.html'
            cards = journal_cards(journal.read_text(encoding='utf-8-sig'), vk_publish.JOURNAL_URL)
            emit(vk_publish.publish(args.queue, cards, journal_cards))
        else:
            network(args)
    except (ValueError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except Exception:
        # A transport/library exception must not dump environment or credentials.
        print('Операция не подтверждена: ошибка транспорта/библиотеки. Credentials не выводятся.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
