from pathlib import Path
import json,struct,base64
root=Path('C:/Users/moyv/Software/Game/Tavem/SillyTavern-Test/data/default-user')
def png(p):
 data=p.read_bytes();i=8
 while i<len(data):
  n=struct.unpack('>I',data[i:i+4])[0];typ=data[i+4:i+8];val=data[i+8:i+8+n];i+=n+12
  if typ==b'tEXt' and val.startswith(b'chara\0'):return json.loads(base64.b64decode(val.split(b'\0',1)[1]))['data']
bundle=png(Path('本格修仙-测试.png'));actual=png(root/'characters/本格修仙-测试.png');world=json.loads((root/'worlds/本格修仙-完整测试世界书.json').read_text(encoding='utf8'))
expected={e['comment']:e for e in bundle['character_book']['entries']};entries=list(world['entries'].values());bad=[e['comment'] for e in entries if e['comment'] not in expected or e['content']!=expected[e['comment']]['content']]
report={'bindingCorrect':actual['extensions']['world']=='本格修仙-完整测试世界书','worldEntries':len(entries),'contentMismatches':len(bad),'regexMatch':actual['extensions']['regex_scripts']==bundle['extensions']['regex_scripts'],'scriptMatch':actual['extensions']['tavern_helper']==bundle['extensions']['tavern_helper'],'dailyDisabled':next(e['disable'] for e in entries if e['comment']=='[事件]五毒教-日常')}
Path('scratchpad/chapter-sync-readback.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');assert not bad and len(entries)==263 and all(v for k,v in report.items() if k not in ['worldEntries','contentMismatches']);print('PASS installed full test: 263 entries, binding, scripts, regexes, daily exclusion.')
