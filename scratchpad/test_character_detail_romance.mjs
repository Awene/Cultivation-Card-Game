import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {pluginSourcePath,chatRuntime} from './ejs_chat_runtime.mjs';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);
function row(s){let a=[],v='',q=false;for(let i=0;i<s.length;i++){let c=s[i];if(c==='"'){if(q&&s[i+1]==='"'){v+='"';i++;}else q=!q;}else if(c===','&&!q){a.push(v);v='';}else v+=c;}return [...a,v];}
const [h,...rs]=read('Doc/世界书设定相关/角色蓝图.csv').trimEnd().split('\n').map(row);
const meta=new Map(rs.map(r=>[r[h.indexOf('世界')]+'|'+r[0],Object.fromEntries(h.map((k,i)=>[k,r[i]]))]));
const module={exports:{}};
new vm.Script(read(pluginSourcePath.replace('function/chat.ts','3rdparty/ejs.js'))).runInNewContext({module,exports:module.exports});
let checks=0,men=0,women=0;
const ok=(v,m)=>{assert(v,m);checks++;};
const cases=[0,80,81,{好感度:95},{好感度:95,关系:'道侣'},{好感度:95,关系类型:'道侣'},{道侣:true}];
for(const world of ['地球','灵界','冥界'])for(const p of walk('世界书/'+world).filter(p=>p.includes('/人物/')&&p.endsWith('.txt'))){
 const src=read(p),m=src.match(/const C = (\{[\s\S]*?\n\});/);
 ok(m,p+'人物字典');
 const C=vm.runInNewContext('('+m[1]+')');
 for(const [name,c]of Object.entries(C)){
  const info=meta.get(world+'|'+name);ok(info,name+'性别可核验');
  if(info.性别==='男'){
   men++;ok(!c.表白&&!c.道侣&&!/\[(表白|道侣相处)\]/.test(c.detail),name+'无女性感情段');
   if(world!=='地球')ok(!info.主动表白&&!info.道侣相处,name+'CSV无女性感情段');
  }
  if(world==='地球'){
   for(const label of ['角色魅力:','着装(外):','着装(内):','法宝:','底色:'])ok(c.detail.includes(label),name+label);
   ok((c.detail.match(/^\[[^\]]+\]$/gm)||[]).length===2,name+'两组性格');
   ok((c.detail.match(/^① /gm)||[]).length===2&&(c.detail.match(/^③ /gm)||[]).length===2,name+'每组3例');
   ok(!/\[(表白|道侣相处)\]/.test(c.detail),name+'感情段独立');
   if(info.性别==='女'){
    women++;ok(Number(info.实际年龄)>=18&&Number(info.实际年龄)<=35,name+'年龄18至35');
    ok(c.表白?.startsWith('[表白]')&&c.道侣?.includes('④ '),name+'女性感情段完整');
   }
  }
  if(info.性别==='男'||world==='地球'){
   for(const rel of cases){
    const vars={'stat_data.关系列表':{[name]:rel},'stat_data.地点.具体地点':'','stat_data.地点.世界':world};
    const out=module.exports.render(src,{getMessageVar:(k,o={})=>vars[k]??o.defaults,...chatRuntime([])});
    ok(!out.includes('undefined')&&!out.includes('NaN'),name+'有效输出');
    if(info.性别==='男')ok(!out.includes('[表白]')&&!out.includes('[道侣相处]'),name+'男性关系分支');
    else if(world==='地球'){
     const partner=rel?.道侣||(rel?.关系??rel?.关系类型)==='道侣',score=typeof rel==='number'?rel:rel?.好感度??0;
     ok(out.includes('[道侣相处]')===!!partner,name+'道侣分支');
     ok(out.includes('[表白]')===(!partner&&score>80),name+'表白分支');
    }
   }
  }
 }
}
assert.equal(women,37);
console.log(JSON.stringify({checks,earthWomen:women,menAudited:men}));

