from pathlib import Path
import subprocess,urllib.request,urllib.parse,hashlib,time,concurrent.futures,json,sys
sys.stdout.reconfigure(encoding="utf-8")
root=Path(__file__).resolve().parent.parent
front=root.parent/"tavern_helper_template-main"
tag=sys.argv[1]
paths=["dist/修仙状态栏/index.html","dist/自定义开局/index.html","dist/正文美化/index.html","dist/创意工坊/index.js","dist/楼层iframe回收/index.js"]
if "--maps" in sys.argv:
 paths=[p.relative_to(front).as_posix() for p in (front/"src/修仙状态栏/maps").rglob("*.png")]
def check(path):
 expected=subprocess.check_output(["git","show",tag+":"+path],cwd=front)
 sha=lambda b:hashlib.sha256(b).hexdigest()
 url="https://testingcf.jsdelivr.net/gh/Awene/tavern_helper_template-main@"+tag+"/"+urllib.parse.quote(path)
 for i in range(3):
  try:
   with urllib.request.urlopen(url,timeout=25) as r: data=r.read();status=r.status
   assert sha(data)==sha(expected),path+" hash mismatch"
   result=dict(path=path,status=status,bytes=len(data),sha256=sha(data))
   print(json.dumps(result,ensure_ascii=False),flush=True)
   return result
  except Exception as e:
   print(path, str(e),flush=True)
   if i==2: return dict(path=path,error=str(e))
   time.sleep(3)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex: results=list(ex.map(check,paths))
mode="maps" if "--maps" in sys.argv else "entries"
(root/"scratchpad"/("release-"+tag+"-cdn-"+mode+".json")).write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
assert all("error" not in r for r in results)
