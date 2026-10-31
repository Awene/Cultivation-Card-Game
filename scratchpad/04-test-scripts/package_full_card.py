import json,struct,base64,zlib,sys,shutil
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path('.'); front=Path('../tavern_helper_template-main/dist'); out=root/'导出/本格修仙-完整构建-20261030';out.mkdir(parents=True,exist_ok=True)
b=(root/'本格修仙.png').read_bytes();chunks=[];pos=8;card=None
while pos<len(b):
 n=struct.unpack('>I',b[pos:pos+4])[0];t=b[pos+4:pos+8];d=b[pos+8:pos+8+n];chunks.append((t,d));pos+=n+12
 if t==b'tEXt' and d.split(b'\0',1)[0]==b'chara':card=json.loads(base64.b64decode(d.split(b'\0',1)[1]))
assert card is not None
original_count=len(card['data']['character_book']['entries']);name='本格修仙·完整构建20261030';card['name']=name;card['data']['name']=name;card['data']['character_book']['name']=name;card['data']['extensions']['world']=name
bootstrap='''<body>PAYLOAD<script>
(() => {
PREP
const bytes = Uint8Array.from(atob('BASE64'), ch => ch.charCodeAt(0));
const parsed = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'text/html');
const scripts = Array.from(parsed.querySelectorAll('script'));
scripts.forEach(script => script.remove());
document.body.innerHTML = parsed.body.innerHTML;
for (const node of Array.from(parsed.head.childNodes)) document.head.appendChild(document.importNode(node, true));
for (const original of scripts) {
 const script = document.createElement('script');
 for (const attr of Array.from(original.attributes)) script.setAttribute(attr.name, attr.value);
 script.textContent = original.textContent;
 document.body.appendChild(script);
}
})();
</script></body>'''
for r in card['data']['extensions']['regex_scripts']:
 if r['scriptName'] not in ['自定义开局','状态栏','正文美化']:continue
 kind='修仙状态栏' if r['scriptName']=='状态栏' else r['scriptName'];html=(front/kind/'index.html').read_bytes();text=bootstrap.replace('BASE64',base64.b64encode(html).decode())
 if kind=='正文美化':
  r['findRegex']=r'/<(now_plot|gametxt)>([\s\S]*?)<\/\1>/gi';text=text.replace('PAYLOAD','<div id="rbPayload" hidden>$2</div>').replace('PREP',"window.__rb_content_payload = document.getElementById('rbPayload').innerHTML;")
 else:text=text.replace('PAYLOAD','').replace('PREP','')
 r['replaceString']='```html\n'+text+'\n```';r['disabled']=False
 # Keep body history readable while retaining ordinary status depth settings.
 if kind=='正文美化':r['maxDepth']=None
assert len(card['data']['character_book']['entries'])==original_count
entry=next(e for e in card['data']['character_book']['entries'] if e.get('comment')=='[公共]统一剧情调度');assert 'dispatchPlots' in entry['content']
assert 'collectPlotState0' in next(e for e in card['data']['character_book']['entries'] if e.get('comment')=='[mvu_update]变量更新规则')['content']
def pack(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
data=json.dumps(card,ensure_ascii=False,separators=(',',':')).encode();encoded=base64.b64encode(data)
result=b'\x89PNG\r\n\x1a\n'+b''.join(pack(t,(d.split(b'\0',1)[0]+b'\0'+encoded) if t==b'tEXt' and d.split(b'\0',1)[0] in [b'chara',b'ccv3'] else d) for t,d in chunks)
(out/'本格修仙-完整构建.png').write_bytes(result)
shutil.copyfile(root/'预设/本格修仙/本格修仙Kemini5-3.4.json',out/'本格修仙-配套完整预设.json')
# Validate embedded source bytes and category/initialization fixes, not merely output existence.
for r in card['data']['extensions']['regex_scripts']:
 if r['scriptName'] not in ['自定义开局','状态栏','正文美化']:continue
 import re
 body=base64.b64decode(re.search(r"atob\('([^']+)'\)",r['replaceString'])[1]);kind='修仙状态栏' if r['scriptName']=='状态栏' else r['scriptName'];assert body==(front/kind/'index.html').read_bytes()
 if kind=='自定义开局':assert '吞下五彩怪果'.encode() in body
print(json.dumps({'card':str(out/'本格修仙-完整构建.png'),'worldbook_entries':original_count,'scripts':len(card['data']['extensions']['tavern_helper']['scripts']),'bytes':len(result)},ensure_ascii=False))
(out/'开始测试.txt').write_text('''完整构建测试步骤
1. 在酒馆角色管理中导入“本格修仙-完整构建.png”，同意导入内置世界书。角色名为“本格修仙·完整构建20261030”。
2. 导入“本格修仙-配套完整预设.json”，在预设下拉框选中刚导入的预设，沿用你自己的模型/API连接。
3. 确认角色绑定世界书“本格修仙·完整构建20261030”。不要沿用旧的南疆测试世界书。
4. 进入该角色的全新聊天，点击开启命途，选择“走出瘴林·万毒祖窟”，重新完成角色选择。
5. 确认页应显示“吞果初醒”的首幕卡。确认开局会发送包含最新约束的新输入，才是新版本测试；不要在旧聊天中点重新生成代替。
6. 首轮先检查吞果—昏迷—苏醒、底部祖窟历练及自由模式。正文不重复插入初始化首幕卡，也不应另建“寻找万毒祖窟”。
7. 刷新后检查历练与物品保留。把正文及异常反馈给助手；后续由助手建议输入、你手动发送。

本包来源于完整主工程：263条世界书、完整脚本和配套预设；并非只包含南疆的精简卡。仅南疆目前接入统一剧情调度，其他地区保留工程原状。三个关键前端为最新构建内嵌，常规扩展、字体和地图等外部依赖仍按工程设置使用。未替你调用模型验证运行效果，也未覆盖现有聊天。
''',encoding='utf-8')
