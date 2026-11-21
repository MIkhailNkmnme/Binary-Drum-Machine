"""Copy the public journal catalog and its media to the Pages origin."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
import json
import re

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "issledovanie" / "image-journal"
BACKUP = PAGE / "backup"
HOSTS = (
    "https://media.1001100.online",
    "https://zerkalius-mayatnik-journal.zerkalius-1001100.workers.dev",
)
MEDIA_KEY = re.compile(
    r"(?:image-journal-\d{4}-\d{2}-\d{2}/[a-z0-9-]+\.(?:png|webp|gif)|"
    r"from-mayatnik/\d{13}-[a-f0-9-]{36}\.(?:png|gif|mp4|webm))"
)
SCENE_ID = re.compile(r"[a-f0-9]{64}")
SCENE_CODE = re.compile(r"[01]\.[A-Za-z0-9_-]+")
TYPES = {"png":"image/png","webp":"image/webp","gif":"image/gif","mp4":"video/mp4","webm":"video/webm"}


def read(path, media_type=None):
    for host in HOSTS:
        try:
            req = Request(host + "/" + path, headers={
                "User-Agent":"Mozilla/5.0", "Origin":"https://1001100.online"
            })
            with urlopen(req, timeout=25) as res:
                if media_type and res.headers.get_content_type() != media_type:
                    raise ValueError("Unexpected file type for " + path)
                return res.read()
        except Exception as error:
            last = error
    raise RuntimeError("Both addresses failed for " + path) from last


def api(path):
    return json.loads(read("mayatnik-api/" + path))


def key_for(url):
    parts = urlsplit(url)
    key = parts.path.lstrip("/")
    if f"{parts.scheme}://{parts.netloc}" in HOSTS and MEDIA_KEY.fullmatch(key):
        return key
    return None


class JournalAssets(HTMLParser):
    def __init__(self, withdrawn):
        super().__init__()
        self.withdrawn = withdrawn
        self.keys = set()
        self.templates = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "template":
            self.templates.append(attrs.get("data-archive-key"))
        if any(key in self.withdrawn for key in self.templates):
            return
        for attr in ("src", "href", "poster"):
            key = key_for(attrs.get(attr, ""))
            if key and key not in self.withdrawn:
                self.keys.add(key)

    def handle_endtag(self, tag):
        if tag == "template" and self.templates:
            self.templates.pop()


def collect_frames(withdrawn):
    frames = []
    cursor = None
    seen = set()
    while True:
        page = api("frames" + ("?" + urlencode({"cursor":cursor}) if cursor else ""))
        for frame in page["frames"]:
            key = key_for(frame["url"])
            if not key or key in withdrawn:
                continue
            frames.append({**frame, "url":HOSTS[0] + "/" + key})
        cursor = page["cursor"]
        if not cursor:
            return frames
        if cursor in seen:
            raise ValueError("The catalog returned a repeated cursor")
        seen.add(cursor)


def main():
    withdrawn = set(api("editor/hidden")["keys"])
    archive = JournalAssets(withdrawn)
    archive.feed((PAGE / "index.html").read_text(encoding="utf-8"))
    frames = collect_frames(withdrawn)
    keys = archive.keys | {key_for(frame["url"]) for frame in frames}
    scenes = {frame["scene"] for frame in frames if SCENE_ID.fullmatch(frame.get("scene", ""))}

    old_catalog = BACKUP / "catalog.json"
    before = json.loads(old_catalog.read_text(encoding="utf-8")) if old_catalog.exists() else {}
    stale_media = {key for key in before.get("media", []) if MEDIA_KEY.fullmatch(key)} - keys
    stale_scenes = {key for key in before.get("scenes", []) if SCENE_ID.fullmatch(key)} - scenes

    with TemporaryDirectory(prefix="journal-pages-") as work:
        staged = Path(work)
        def mirror(key):
            kind = key.rsplit(".", 1)[1]
            data = read(key, TYPES[kind])
            file = staged / key
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
            return len(data)

        def copy_scene(digest):
            code = api("scene?" + urlencode({"id":digest}))["code"]
            if not SCENE_CODE.fullmatch(code):
                raise ValueError("Invalid public scene")
            file = staged / "scenes" / f"{digest}.txt"
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(code, encoding="ascii")
            return len(code)

        with ThreadPoolExecutor(max_workers=8) as pool:
            total = sum(pool.map(mirror, sorted(keys))) + sum(pool.map(copy_scene, sorted(scenes)))

        if set(api("editor/hidden")["keys"]) != withdrawn:
            raise RuntimeError("The withdrawn list changed during the copy. Rerun the build.")

        catalog = {
            "saved":datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "frames":frames, "withdrawn":sorted(withdrawn), "media":sorted(keys), "scenes":sorted(scenes),
        }
        for file in staged.rglob("*"):
            if not file.is_file():
                continue
            target = BACKUP / file.relative_to(staged)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(file.read_bytes())
        next_catalog = BACKUP / "catalog.json.new"
        next_catalog.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        next_catalog.replace(BACKUP / "catalog.json")
        for key in stale_media:
            (BACKUP / key).unlink(missing_ok=True)
        for digest in stale_scenes:
            (BACKUP / "scenes" / f"{digest}.txt").unlink(missing_ok=True)
    print(f"{len(keys)} public media files, {len(frames)} feed entries, {len(scenes)} scenes, {total} bytes")


if __name__ == "__main__":
    main()
