import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('../tavern_helper_template-main/package.json'));
const config=require('yaml').parse(fs.readFileSync('本格修仙.yaml','utf8'));
const entries=config.条目.filter(e=>e.文件?.startsWith('世界书\\灵界\\'));
const files=fs.readdirSync('世界书/灵界',{recursive:true}).filter(f=>f.endsWith('.txt')).map(f=>path.resolve('世界书/灵界',f));
assert.equal(entries.length,files.length,'all spirit txt entries registered');
assert.equal(new Set(entries.map(e=>e.名称)).size,entries.length,'unique names');
const compile=src=>new vm.Script('let out="";\n'+[...src.matchAll(/<%([_=\-]?)([\s\S]*?)([_\-]?)%>/g)].map(m=>['-','='].includes(m[1])?'out+=('+m[2]+');':m[2]).join('\n')+'\nout;');
const run=(p,world,region,location='',messages=[])=>p.runInNewContext({getMessageVar:k=>({'stat_data.地点.世界':world,'stat_data.地点.地域':region,'stat_data.地点.具体地点':location,'stat_data.关系列表':{}}[k]),getChatMessages:n=>{assert(n===-10||n===10,'known EJS API');return messages;}},{timeout:3000});
let people=0; const stale=[]; let book;
const png=fs.readFileSync('本格修仙.png');
for(let p=8;p<png.length;){const n=png.readUInt32BE(p),type=png.toString('ascii',p+4,p+8),data=png.subarray(p+8,p+8+n);if(type==='tEXt'&&data.toString('utf8',0,data.indexOf(0))==='chara')book=JSON.parse(Buffer.from(data.subarray(data.indexOf(0)+1).toString(),'base64').toString()).data.character_book.entries;p+=12+n;}
for(const e of entries){
 const file=path.resolve(e.文件+'.txt'); assert(files.includes(file),e.名称+' file index');
 assert(e.启用&&e.激活概率===100,e.名称+' enabled');
 const src=fs.readFileSync(file,'utf8'),p=compile(src),region=e.文件.split('\\')[2];
 assert.equal(run(p,'凡界',region),'',e.名称+' world gate');
 if(e.文件.includes('\\人物\\')){
  const C=JSON.parse(src.match(/const C = (\{[\s\S]*?\n\});/)[1]);
  for(const name of Object.keys(C)){
   assert(e.激活策略.关键字.includes(name),name+' keyword index');
   assert(run(p,'灵界',region,'',[name]).includes('### '+name),name+' EJS detail'); people++;
  }
 }else assert(run(p,'灵界',region,region).includes('region_information'),e.名称+' render');
 const embedded=book?.find(b=>b.comment===e.名称);
 if(!embedded||embedded.content.replace(/\r\n/g,'\n').trim()!==src.replace(/\r\n/g,'\n').trim())stale.push(e.名称);
}
console.log(JSON.stringify({entries:entries.length,people,sourceIndexAndTriggers:'PASS',pngStaleCount:stale.length,pngStale:stale},null,2));
if(process.argv.includes('--strict-png'))assert.equal(stale.length,0,'PNG synchronized');
