import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {setDefaultResultOrder} from 'node:dns';
setDefaultResultOrder('ipv4first');
const [mode,tag]=process.argv.slice(2);
assert(/^v\d+\.\d+\.\d+$/.test(tag));
const frontend='../tavern_helper_template-main',hash=b=>createHash('sha256').update(b).digest('hex');
const paths=['dist/修仙状态栏/index.html','dist/自定义开局/index.html','dist/正文美化/index.html','dist/创意工坊/index.js','dist/楼层iframe回收/index.js'];
if(mode==='cdn'){
 const maps=readdirSync(frontend+'/src/修仙状态栏/maps',{recursive:true}).filter(p=>p.endsWith('.png')).map(p=>'src/修仙状态栏/maps/'+p.replaceAll('\\','/'));
 const filter=process.argv.find(a=>a.startsWith('--filter='))?.slice(9)||'';
 await Promise.all((process.argv.includes('--maps-only')?maps:[...paths,...maps]).filter(p=>p.includes(filter)).map(async path=>{
  const expected=execFileSync('git',['show',tag+':'+path],{cwd:frontend,maxBuffer:32*1024*1024});
  const url='https://testingcf.jsdelivr.net/gh/Awene/tavern_helper_template-main@'+tag+'/'+path;
  let response;
  for(let attempt=0;attempt<3;attempt++){
   try {response=await fetch(url,{signal:AbortSignal.timeout(45000)});break;}
   catch(error){if(attempt===2)throw error;}
  }
  assert.equal(response.status,200,path);const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(hash(bytes),hash(expected),path+' exact bytes');
  if(path.endsWith('html'))assert(bytes.includes(Buffer.from('<'))&&bytes.length<20*1024*1024,path+' HTML/size');
  console.log(JSON.stringify({path,status:200,bytes:bytes.length,sha256:hash(bytes)}));
 }));
}else if(mode==='png'){
 const require=createRequire(resolve(frontend,'package.json'));
 const cfg=require('yaml').parse(readFileSync('本格修仙.yaml','utf8'));
 const png=readFileSync('本格修仙.png');let count=0;
 const norm=s=>s.replace(/\r\n/g,'\n').trim();
 for(let p=8;p<png.length;){const n=png.readUInt32BE(p),type=png.toString('ascii',p+4,p+8),data=png.subarray(p+8,p+8+n);p+=n+12;if(type!=='tEXt')continue;
  const i=data.indexOf(0),key=data.toString('utf8',0,i);if(!['chara','ccv3'].includes(key))continue;
  const card=JSON.parse(Buffer.from(data.subarray(i+1).toString(),'base64').toString()),d=card.data||card;
  const refs=[...JSON.stringify(d.extensions).matchAll(/tavern_helper_template-main@([^/"\\]+)/g)].map(m=>m[1]);
  assert(refs.length>=6&&refs.every(r=>r===tag),key+' fixed URLs');
  const regex=d.extensions.regex_scripts;
  for(const r of regex.filter(r=>!r.disabled))assert(!/localhost|127\.0\.0\.1|@latest|@master|@main/.test(r.replaceString||''),r.scriptName);
  const book=d.character_book.entries;let checked=0;
  for(const e of cfg.条目.filter(e=>e.文件)){
   const file=['','.txt','.yaml','.ejs','.json','.js'].map(ext=>e.文件+ext).find(existsSync);
   assert(file,e.名称+' source exists');const embedded=book.find(b=>b.comment===e.名称);
   assert(embedded,e.名称+' embedded');assert.equal(norm(embedded.content),norm(readFileSync(file,'utf8')),e.名称+' current content');
   assert.equal(embedded.enabled,e.启用,e.名称+' enabled');checked++;
  }
  console.log(JSON.stringify({chunk:key,entriesChecked:checked,refs,regex:regex.map(r=>({name:r.scriptName,disabled:r.disabled}))}));count++;
 }
 assert(count>0);console.log(JSON.stringify({sha256:hash(png),bytes:png.length}));
}else throw Error('mode must be cdn or png');
