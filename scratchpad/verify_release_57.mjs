import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const tag='v1.0.57',frontend='../tavern_helper_template-main';
const hash=b=>createHash('sha256').update(b).digest('hex');
const paths=['dist/修仙状态栏/index.html','dist/自定义开局/index.html','dist/正文美化/index.html','dist/创意工坊/index.js','dist/楼层iframe回收/index.js'];
if(process.argv[2]==='cdn'){
  const maps=['沧溟大陆','圣银大陆','星坠大陆','灵境大陆','太初大陆','万兽大陆','殒落大陆'].map(r=>'src/修仙状态栏/maps/灵界/'+r+'地图.png');
  for(const path of [...paths,...maps]){
    const expected=execFileSync('git',['show',tag+':'+path],{cwd:frontend,maxBuffer:30*1024*1024});
    const url='https://testingcf.jsdelivr.net/gh/Awene/tavern_helper_template-main@'+tag+'/'+path;
    const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
    assert.equal(response.status,200,path+' CDN status');
    const actual=Buffer.from(await response.arrayBuffer());
    assert.equal(hash(actual),hash(expected),path+' CDN bytes');
    console.log(JSON.stringify({path,status:response.status,bytes:actual.length,sha256:hash(actual)}));
  }
}else if(process.argv[2]==='png'){
  const png=readFileSync('本格修仙.png');let chunks=0;
  for(let p=8;p<png.length;){const n=png.readUInt32BE(p),type=png.toString('ascii',p+4,p+8),data=png.subarray(p+8,p+8+n);p+=n+12;if(type!=='tEXt')continue;
    const i=data.indexOf(0),key=data.toString('utf8',0,i);if(!['chara','ccv3'].includes(key))continue;
    const card=JSON.parse(Buffer.from(data.subarray(i+1).toString(),'base64').toString()),d=card.data||card;
    const ext=d.extensions||{},regex=ext.regex_scripts||[];
    const serialized=JSON.stringify(ext);
    const refs=[...serialized.matchAll(/tavern_helper_template-main@([^/"\\]+)/g)].map(m=>m[1]);
    assert(refs.length>=6&&refs.every(r=>r===tag),key+' fixed references');
    for(const r of regex.filter(r=>!r.disabled))assert(!/localhost|127\.0\.0\.1|@latest|@master|@main/.test(r.replaceString||''),r.scriptName+' production regex');
    const entries=d.character_book?.entries||[];
    const chars=entries.filter(e=>/^\[mvu_plot\]人物-.*大陆-/.test(e.comment||''));
    assert.equal(chars.length,116,key+' spirit files');
    for(const e of chars){assert(e.enabled,key+' enabled '+e.comment);assert(e.content.includes('getChatMessages(-10)'),e.comment+' recent API');assert(e.content.includes('性格')||e.content.includes('底色:'),e.comment+' deep prose');new Function(e.content.match(/<%_\s*\{\s*_%>\s*<%_([\s\S]*?)_%>/)[1]);}
    for(const e of entries)assert(!/getChatMessages\(10\)/.test(e.content||''),key+' stale API '+e.comment);
    console.log(JSON.stringify({chunk:key,name:d.name,entries:entries.length,spiritFiles:chars.length,refs,regex:regex.map(r=>({name:r.scriptName,disabled:r.disabled}))}));chunks++;
  }
  assert(chunks>0,'PNG metadata');console.log(JSON.stringify({pngSha256:hash(png),bytes:png.length}));
}
