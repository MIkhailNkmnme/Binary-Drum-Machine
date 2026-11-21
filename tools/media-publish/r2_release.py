"""Transfer a staged image to the journal's R2 prefix and verify public delivery."""

import base64
import binascii
import hashlib
import json
import os
from pathlib import Path
import re
from tempfile import TemporaryDirectory
import time
from types import SimpleNamespace
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4


PUBLIC_BASE = 'https://media.1001100.online'
RELEASE_PREFIX = '/MIkhailNkmnme/Binary-Drum-Machine/releases/download/'
ASSET_HOSTS = {'release-assets.githubusercontent.com', 'objects.githubusercontent.com'}
JOURNAL_KEY = r'image-journal-\d{4}-\d{2}-\d{2}/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|gif|webp)'
MAX_BYTES = 50 * 1024 * 1024
MAX_INLINE = 48_000
MAX_BATCH = 20
MAX_MANIFEST_BYTES = 32 * 1024


class ObjectAlreadyExists(ValueError):
    pass


def parse_key(key):
    if not isinstance(key, str) or len(key) > 240 or not re.fullmatch(JOURNAL_KEY, key):
        raise ValueError('Укажите ключ image-journal-ГГГГ-ММ-ДД/файл.png, jpg, gif или webp.')
    return key


def parse_digest(digest):
    if not isinstance(digest, str) or not re.fullmatch(r'[A-Fa-f0-9]{64}', digest):
        raise ValueError('Для staged-файла нужна контрольная сумма SHA-256.')
    return digest.lower()


def check_release_url(source):
    if not isinstance(source, str):
        raise ValueError('Нужна HTTPS-ссылка на файл из Releases репозитория сайта.')
    url = urlsplit(source)
    path = unquote(url.path)
    if not (url.scheme == 'https' and url.netloc == 'github.com' and path.startswith(RELEASE_PREFIX)
            and url.path.startswith(RELEASE_PREFIX) and not url.query and not url.fragment):
        raise ValueError('Нужна прямая ссылка на файл из Releases репозитория сайта.')
    parts = path[len(RELEASE_PREFIX):].split('/')
    if len(parts) != 2 or any(part in ('', '.', '..') or '\\' in part for part in parts):
        raise ValueError('Ссылка Releases должна содержать тег и имя файла.')
    for char in path:
        if ord(char) < 32 or ord(char) == 127:
            raise ValueError('Некорректная ссылка Releases.')


class ImageRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, destination):
        target = urlsplit(destination)
        if not (urlsplit(request.full_url).hostname in ASSET_HOSTS | {'github.com'}
                and target.scheme == 'https' and target.netloc in ASSET_HOSTS):
            return None
        return super().redirect_request(request, fp, code, message, headers, destination)


def download(url, label, *, absent_ok=False, limit=MAX_BYTES):
    request = Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'ZerkaliusImageJournal/1.0'})
    try:
        with build_opener(ImageRedirect()).open(request, timeout=45) as response:
            data = response.read(limit + 1)
            content_type = response.headers.get_content_type()
    except HTTPError as error:
        if absent_ok and error.code == 404:
            return None
        raise ValueError(f'{label}: HTTP {error.code}.') from None
    except (URLError, OSError):
        raise ValueError(f'{label}: соединение не подтверждено.') from None
    if not 0 < len(data) <= limit:
        raise ValueError(f'{label}: нужен непустой файл размером до {limit} байт.')
    return data, content_type


def read_public(url, expected, image_type):
    result = download(f'{url}?delivery={uuid4().hex}', 'Проверка публичного медиа', absent_ok=True)
    if result is None:
        return False
    data, mime = result
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError('По этому ключу уже доступен другой файл. Выберите новый ключ.')
    if image_type(data) != mime:
        raise ValueError('Публичный сервер вернул неожиданный Content-Type.')
    return True


def transfer(key, digest, source_url, inline, upload, image_type):
    key, digest = parse_key(key), parse_digest(digest)
    if bool(source_url) == bool(inline):
        raise ValueError('Укажите один источник — ссылку GitHub Release или данные небольшого файла.')
    if source_url:
        check_release_url(source_url)
    elif len(inline) > MAX_INLINE:
        raise ValueError('Данные файла длиннее 48 000 символов Base64. Используйте файл из Releases.')

    public_url = PUBLIC_BASE + '/' + quote(key, safe='/')
    if read_public(public_url, digest, image_type):
        return dict(key=key, public_url=public_url, existing=True, sha256=digest)

    if source_url:
        data = download(source_url, 'Файл выпуска GitHub')[0]
    else:
        try:
            data = base64.b64decode(inline, validate=True)
        except (ValueError, binascii.Error):
            raise ValueError('Ожидались данные файла в Base64.') from None
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError('SHA-256 исходника не совпадает с указанным.')
    image_type(data)

    with TemporaryDirectory(prefix='journal-r2-') as folder:
        file = Path(folder) / 'image'
        file.write_bytes(data)
        try:
            upload(SimpleNamespace(command='upload', key=key, file=str(file)))
            existing = False
        except ObjectAlreadyExists:
            existing = True

    for pause in (0, 3, 6, 12):
        time.sleep(pause)
        if read_public(public_url, digest, image_type):
            return dict(key=key, public_url=public_url, existing=existing, sha256=digest)
    raise ValueError('Объект есть в R2, но публичная доставка пока не подтверждена. Повторите запуск.')


def upload_one(args, upload, image_type):
    return transfer(args.key, args.sha256, args.source_url,
                    os.environ.get('R2_IMAGE_BASE64', '').strip(), upload, image_type)


def upload_batch(args, upload, image_type):
    check_release_url(args.source_url)
    expected = parse_digest(args.sha256)
    release_path = urlsplit(args.source_url).path.rsplit('/', 1)[0]
    data, _ = download(args.source_url, 'Манифест выпуска', limit=MAX_MANIFEST_BYTES)
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError('SHA-256 манифеста не совпадает с указанным.')
    try:
        manifest = json.loads(data)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise ValueError('Манифест должен быть корректным JSON.') from None
    if not isinstance(manifest, dict) or set(manifest) != {'files'}:
        raise ValueError('Манифест должен содержать список files.')
    files = manifest['files']
    if not isinstance(files, list) or not 1 <= len(files) <= MAX_BATCH:
        raise ValueError(f'В одном манифесте допускается от 1 до {MAX_BATCH} файлов.')

    keys = set()
    selected = []
    for item in files:
        if not isinstance(item, dict) or set(item) != {'key', 'sha256', 'source_url'}:
            raise ValueError('Для каждого файла нужны key, sha256 и source_url.')
        key = parse_key(item['key'])
        digest = parse_digest(item['sha256'])
        source = item['source_url']
        check_release_url(source)
        if urlsplit(source).path.rsplit('/', 1)[0] != release_path:
            raise ValueError('Все файлы должны находиться в том же выпуске GitHub, что и манифест.')
        if key in keys:
            raise ValueError('Ключи R2 в манифесте должны быть уникальны.')
        keys.add(key)
        selected.append((key, digest, source))

    delivered = []
    for key, digest, source in selected:
        delivered.append(transfer(key, digest, source, '', upload, image_type))
    return dict(delivered=delivered)


def upload_selected(releases, upload, image_type):
    delivered = []
    for entry, card in releases:
        if 'source_url' not in entry:
            continue
        key = unquote(urlsplit(card['image_url']).path).lstrip('/')
        delivered.append(transfer(key, entry['sha256'], entry['source_url'], '', upload, image_type))
    return dict(delivered=delivered)
