"""Run one OpenAI Images API request and save its result locally."""

import base64
import json
import os
from pathlib import Path
import re
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def add_arguments(parser):
    parser.add_argument('--prompt-file', required=True)
    parser.add_argument('--source')
    parser.add_argument('--file', required=True)
    parser.add_argument('--model', default='gpt-image-2.5-sunburst')
    parser.add_argument('--size', default='2048x1152')
    parser.add_argument('--quality', choices=['low', 'medium', 'high', 'auto'], default='medium')


def generate(args, repository, image_type, max_image_bytes):
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        raise ValueError('Нужен локальный ключ OpenAI. Запустите media.ps1 configure-openai.')
    output = Path(args.file).expanduser().resolve()
    formats = {'.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp'}
    output_format = formats.get(output.suffix.lower())
    if not output_format or output.is_relative_to(repository):
        raise ValueError('Укажите выходной PNG, JPG или WebP вне репозитория.')
    if not output.parent.is_dir() or output.exists():
        raise ValueError('Каталог результата должен существовать, а имя файла быть свободным.')

    prompt = Path(args.prompt_file).read_text(encoding='utf-8-sig').strip()
    if not prompt:
        raise ValueError('Файл промпта пуст.')
    parameters = dict(model=args.model, size=args.size, quality=args.quality,
                      output_format=output_format, n=1, prompt=prompt)
    operation = 'generations'
    if args.source:
        source = Path(args.source)
        if source.stat().st_size > max_image_bytes:
            raise ValueError('Исходник больше 50 МиБ.')
        image = source.read_bytes()
        kind = image_type(image)
        if kind not in ('image/png', 'image/jpeg', 'image/webp'):
            raise ValueError('Для редактирования нужен PNG, JPEG или WebP.')
        encoded = base64.b64encode(image).decode('ascii')
        parameters['images'] = [{'image_url': f'data:{kind};base64,{encoded}'}]
        operation = 'edits'

    request = Request(f'https://api.openai.com/v1/images/{operation}',
                      data=json.dumps(parameters).encode('utf-8'),
                      headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    try:
        with build_opener(NoRedirect()).open(request, timeout=240) as response:
            payload = json.load(response)
    except HTTPError as exc:
        code = ''
        try:
            code = json.load(exc).get('error', {}).get('code') or ''
        except (ValueError, AttributeError):
            pass
        safe_code = f' ({code})' if isinstance(code, str) and re.fullmatch(r'[a-z0-9_]{1,64}', code) else ''
        raise ValueError(f'Images API ответил HTTP {exc.code}{safe_code}.') from None
    data = base64.b64decode(payload['data'][0]['b64_json'], validate=True)
    if image_type(data) != f'image/{output_format}':
        raise ValueError('Ответ Images API имеет неожиданный формат.')
    with output.open('xb') as handle:
        handle.write(data)
    return dict(file=str(output), model=args.model, operation=operation, bytes=len(data))
