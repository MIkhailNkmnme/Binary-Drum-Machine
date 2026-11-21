"""Publish selected image-journal entries to the Zerkalis community."""

import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4


GROUP_ID = 240613453
JOURNAL_URL = 'https://1001100.online/issledovanie/image-journal/'
VK_API_VERSION = '5.199'
MAX_BYTES = 50 * 1024 * 1024
MAX_PIXELS = 24_000_000


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def fetch(request, label, limit=MAX_BYTES):
    try:
        with build_opener(NoRedirect()).open(request, timeout=20) as response:
            data = response.read(limit + 1)
    except HTTPError as exc:
        raise ValueError(f'{label}: HTTP {exc.code}.') from None
    except (OSError, URLError):
        raise ValueError(f'{label}: соединение не подтверждено.') from None
    if len(data) > limit:
        raise ValueError(f'{label}: ответ превышает допустимый размер.')
    return data


def api(method, token, **arguments):
    form = urlencode(dict(arguments, v=VK_API_VERSION, access_token=token)).encode()
    request = Request(f'https://api.vk.com/method/{method}', data=form)
    label = f'VK {method}'
    payload = json.loads(fetch(request, label, 3 * 1024 * 1024))
    if 'error' in payload:
        code = payload['error'].get('error_code')
        if code == 5:
            raise ValueError(f'{label}: пользовательский токен VK отклонён (код 5).')
        raise ValueError(f'{label}: ошибка API {code if isinstance(code, int) else "без кода"}.')
    if 'response' not in payload:
        raise ValueError(f'{label}: ответ VK не подтверждён.')
    return payload['response']


def releases(queue, cards):
    indexed = {(card['entry_anchor'], card['image_url']): card for card in cards}
    selected = {}
    for file in sorted(Path(queue).glob('*.json')):
        entry = json.loads(file.read_text(encoding='utf-8-sig'))
        if not isinstance(entry, dict) or set(entry) != {'entry', 'image'}:
            raise ValueError(f'{file.name}: укажите поля entry и image.')
        anchor, image = entry['entry'], entry['image']
        if not isinstance(anchor, str) or not re.fullmatch(r'[a-z0-9][a-z0-9-]*', anchor):
            raise ValueError(f'{file.name}: некорректный якорь записи.')
        if not isinstance(image, str) or (anchor, image) not in indexed or anchor in selected:
            raise ValueError(f'{file.name}: нужен один оригинал из указанной записи журнала.')
        selected[anchor] = indexed[anchor, image]
    return list(selected.values())


def wait_for_journal(expected, parse_cards):
    # Wait for the Pages deployment that contains these exact cards.
    for attempt in range(15):
        try:
            request = Request(JOURNAL_URL, headers={'Cache-Control': 'no-cache'})
            page = fetch(request, 'Живой журнал', 2 * 1024 * 1024).decode('utf-8-sig')
            live = {card['id']: card for card in parse_cards(page, JOURNAL_URL)}
            if all(live.get(card['id']) == card for card in expected):
                return
        except ValueError:
            pass
        if attempt < 14:
            time.sleep(15)
    raise ValueError('Публикация ещё не появилась на сайте. Повторите запуск после доставки журнала.')


def wall_posts(token, entry_urls):
    found = {}
    offset = 0
    while True:
        response = api('wall.get', token, owner_id=-GROUP_ID, filter='owner', count=100, offset=offset)
        items = response['items']
        for post in items:
            if post.get('from_id') != -GROUP_ID:
                continue
            for line in post.get('text', '').splitlines():
                url = line.strip()
                if url in entry_urls:
                    found[url] = post['id']
        offset += len(items)
        if offset >= response['count'] or len(found) == len(entry_urls):
            return found
        if not items:
            raise ValueError('VK вернул неполный список записей. Проверка дублей прервана.')
        time.sleep(.35)


def upload_photo(token, image_url):
    from PIL import Image

    source = fetch(image_url, 'Оригинал из R2')
    buffer = BytesIO()
    with Image.open(BytesIO(source)) as image:
        if image.width * image.height > MAX_PIXELS:
            raise ValueError('Фото из R2 превышает допустимое число пикселей для анонса.')
        image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
        rgba = image.convert('RGBA')
        canvas = Image.new('RGB', image.size, '#101317')
        canvas.paste(rgba, mask=rgba.getchannel('A'))
        canvas.save(buffer, 'JPEG', quality=92)

    server = api('photos.getWallUploadServer', token, group_id=GROUP_ID)
    upload = server['upload_url']
    url = urlsplit(upload)
    host = url.hostname or ''
    if (url.scheme != 'https' or url.username or url.password or url.port not in (None, 443)
            or not any(host == root or host.endswith('.' + root)
                       for root in ('vk.com', 'vk.ru', 'userapi.com'))):
        raise ValueError('VK вернул неизвестный адрес загрузки фото.')
    boundary = uuid4().hex
    part = (f'--{boundary}\r\nContent-Disposition: form-data; name="photo"; '
            'filename="journal.jpg"\r\nContent-Type: image/jpeg\r\n\r\n').encode()
    body = part + buffer.getvalue() + f'\r\n--{boundary}--\r\n'.encode()
    request = Request(upload, data=body, headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
    uploaded = json.loads(fetch(request, 'Загрузка фото VK', 1024 * 1024))
    if not uploaded.get('photo') or uploaded['photo'] == '[]':
        raise ValueError('VK не принял фото.')
    photo = api('photos.saveWallPhoto', token, group_id=GROUP_ID,
                photo=uploaded['photo'], server=uploaded['server'], hash=uploaded['hash'])[0]
    attachment = f"photo{photo['owner_id']}_{photo['id']}"
    if photo.get('access_key'):
        attachment += '_' + photo['access_key']
    return attachment


def check():
    token = os.environ.get('VK_USER_TOKEN', '').strip()
    if not token:
        raise ValueError('Секрет VK_USER_TOKEN пока не настроен.')
    api('wall.get', token, owner_id=-GROUP_ID, filter='owner', count=1)
    api('photos.getWallUploadServer', token, group_id=GROUP_ID)
    return dict(wall_read=True, photo_upload_server=True, posted=[])


def publish(queue, local_cards, parse_cards):
    expected = releases(queue, local_cards)
    if not expected:
        return dict(reason='Очередь VK пуста', posted=[])
    token = os.environ.get('VK_USER_TOKEN', '').strip()
    if not token:
        return dict(reason='Секрет VK_USER_TOKEN пока не настроен', posted=[])

    wait_for_journal(expected, parse_cards)
    found = wall_posts(token, {item['entry_url'] for item in expected})
    posted, existing = [], []
    for card in expected:
        entry = card['entry_url']
        if entry in found:
            existing.append(f"https://vk.com/wall{-GROUP_ID}_{found[entry]}")
            continue
        attachment = upload_photo(token, card['image_url'])
        # A retry after an unconfirmed response uses the same VK request identifier.
        guid = hashlib.sha256(entry.encode()).hexdigest()[:32]
        result = api('wall.post', token, owner_id=-GROUP_ID, from_group=1,
                     message=card['caption'], attachments=attachment, guid=guid)
        if not isinstance(result.get('post_id'), int):
            raise ValueError('VK не вернул номер опубликованной записи.')
        posted.append(f"https://vk.com/wall{-GROUP_ID}_{result['post_id']}")
        time.sleep(.35)
    return dict(posted=posted, existing=existing)
