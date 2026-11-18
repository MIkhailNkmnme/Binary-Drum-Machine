from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag, unquote
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests, re, json, hashlib
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
ROOT.mkdir(parents=True,exist_ok=True)
(ROOT/'images').mkdir(exist_ok=True)
SESSION=requests.Session()
SESSION.headers['User-Agent']='Mozilla/5.0 (compatible; local research archive)'
HOSTS={'ninetozero.music','www.ninetozero.music','ninetozero.eu','www.ninetozero.eu'}
IMAGES=re.compile(r'\.(?:png|jpe?g|webp|avif|gif|svg)(?:$|[?#])',re.I)
NON_PAGE_MEDIA=re.compile(r'\.(?:mp3|m4a|ogg|opus|aac|wav|flac|mp4)(?:$|[?#])',re.I)
assets={};pages=[];styles={};seen=set();queue=deque(['https://ninetozero.music/','https://ninetozero.eu/home'])
errors=[]
cached={}
if (ROOT/'assets.json').exists():
    cached={item['url']:item for item in json.loads((ROOT/'assets.json').read_text(encoding='utf-8'))['assets'] if item['status']=='saved' and item.get('kind')=='image'}

def absolute(value,base):
    value=urldefrag(urljoin(base,value.strip().strip('"\'')))[0]
    return value if urlparse(value).scheme in ('http','https') else ''

def add_asset(value,base,page,kind=None):
    url=absolute(value,base)
    if not url:return
    if kind is None:kind='image' if IMAGES.search(url) else None
    if kind!='image' or 'facebook.com/tr' in url:return
    item=assets.setdefault(url,{'url':url,'kind':kind,'pages':[]})
    if page not in item['pages']:item['pages'].append(page)

def css_assets(text,base,page):
    for match in re.finditer(r'url\(\s*([^)]+)\)',text,re.I):add_asset(match.group(1),base,page)

while queue and len(seen)<160:
    url=queue.popleft()
    if url in seen:continue
    seen.add(url)
    try:
        res=SESSION.get(url,timeout=30);res.raise_for_status()
        if 'text/html' not in res.headers.get('content-type',''):continue
        soup=BeautifulSoup(res.text,'html.parser')
        for tag in soup.find_all(True):
            for attr in ['src','data-src','data-lazy-src','poster','data-background','data-background-image']:
                if tag.get(attr):add_asset(tag[attr],res.url,url,'image' if tag.name=='img' or attr=='poster' else None)
            for attr in ['srcset','data-srcset','data-lazy-srcset']:
                for part in str(tag.get(attr,'')).split(','):
                    if part.strip():add_asset(part.strip().split()[0],res.url,url,'image')
            if tag.get('style'):css_assets(tag['style'],res.url,url)
            if tag.name=='meta' and tag.get('property','') in {'og:image','og:image:url','og:image:secure_url'}:add_asset(tag.get('content',''),res.url,url,'image')
            if tag.name=='link' and 'stylesheet' in tag.get('rel',[]):
                stylesheet=absolute(tag.get('href',''),res.url)
                if urlparse(stylesheet).hostname in HOSTS:styles.setdefault(stylesheet,[]).append(url)
            if tag.name=='a' and tag.get('href'):
                target=absolute(tag['href'],res.url)
                if not target:continue
                add_asset(target,res.url,url)
                parsed=urlparse(target)
                if parsed.hostname in HOSTS and not IMAGES.search(target) and not NON_PAGE_MEDIA.search(target) and not re.search(r'\.(?:pdf|zip|mp4|css|js)$',parsed.path,re.I) and not parsed.query and '/wp-' not in parsed.path:
                    if target not in seen:queue.append(target)
        for style in soup.find_all('style'):css_assets(style.get_text(),res.url,url)
        # CSS image links also occur as JSON strings in page blocks.
        for match in re.finditer(r'https?[^\s<>"\']+\.(?:png|jpe?g|webp|svg|gif|avif)(?:\?[^\s<>"\']*)?',res.text,re.I):
            add_asset(match.group().replace('\\/','/'),res.url,url)
        pages.append({'url':url,'final_url':res.url,'title':soup.title.get_text(' ',strip=True) if soup.title else ''})
        print(json.dumps({'page':url,'images_found':len(assets)},ensure_ascii=True),flush=True)
    except Exception as error:errors.append({'url':url,'error':str(error)})

for url,uses in styles.items():
    try:
        res=SESSION.get(url,timeout=25);res.raise_for_status()
        for page in uses:css_assets(res.text,res.url,page)
    except Exception as error:errors.append({'url':url,'error':str(error)})

def download(item):
    try:
        old=cached.get(item['url'])
        if old and (ROOT/old['file']).is_file() and hashlib.sha256((ROOT/old['file']).read_bytes()).hexdigest()==old['sha256']:
            return {**old,'pages':item['pages']}
        with requests.get(item['url'],headers={'User-Agent':'Mozilla/5.0'},timeout=35,stream=True) as res:
            res.raise_for_status();mime=res.headers.get('content-type','').split(';')[0]
            if not (mime.startswith(item['kind']+'/') or (item['kind']=='image' and 'svg' in mime)):
                raise ValueError('Unexpected content type '+mime)
            body=bytearray()
            for block in res.iter_content(65536):
                body.extend(block)
                if len(body)>100*1024*1024:raise ValueError('Asset exceeds 100 MB; left as source link')
        digest=hashlib.sha256(body).hexdigest()
        leaf=re.sub(r'[^a-zA-Z0-9._-]','_',unquote(urlparse(item['url']).path).split('/')[-1])[:110]
        ext=Path(leaf).suffix
        if not ext:leaf += {'image/jpeg':'.jpg','image/png':'.png','image/svg+xml':'.svg','image/webp':'.webp'}.get(mime,'.bin')
        folder='images'
        path=ROOT/folder/(digest[:12]+'-'+leaf)
        path.write_bytes(body)
        return {**item,'file':path.relative_to(ROOT).as_posix(),'sha256':digest,'bytes':len(body),'mime':mime,'status':'saved'}
    except Exception as error:return {**item,'status':'error','error':str(error)}

results=[]
with ThreadPoolExecutor(max_workers=5) as pool:
    for future in as_completed([pool.submit(download,item) for item in assets.values()]):
        result=future.result();results.append(result)
        print(json.dumps({'asset':result.get('file',result['url']),'status':result['status']},ensure_ascii=True),flush=True)
# Multiple responsive sizes with identical content share a single canonical file.
unique={}
for item in sorted(results,key=lambda x:x['url']):
    if item['status']!='saved':continue
    if item['sha256'] in unique:
        prior=unique[item['sha256']]
        if item['file']!=prior:
            (ROOT/item['file']).unlink()
        item['file']=prior
    else:unique[item['sha256']]=item['file']
manifest={'captured_date':'2026-11-16','entrypoints':['https://ninetozero.music/','https://ninetozero.eu/home'],'scope':'Images from public pages on ninetozero.music and ninetozero.eu; image files and their provenance only.','pages':pages,'assets':sorted(results,key=lambda x:x['url']),'errors':errors,'pending_pages':list(queue)}
(ROOT/'assets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'pages':len(pages),'unique_files':len(unique),'errors':len(errors)+sum(x['status']=='error' for x in results),'pending':len(queue)}),flush=True)
