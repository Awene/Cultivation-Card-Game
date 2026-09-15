import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {people,secrets,sects,governments,ecologies,artifacts,overviewPath} from './build_underworld.mjs';
const require=createRequire(resolve('../tavern_helper_template-main/package.json'));
const YAML=require('yaml');
const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
let checks=0;
const check=(value,message)=>{assert(value,message);checks++;};
export function render(source,values={},chat=[]){
  let end=0,code='let out="";\n';
  for(const m of source.matchAll(/<%([_=\-]?)([\s\S]*?)([_\-]?)%>/g)){
    code+='out+='+JSON.stringify(source.slice(end,m.index))+';\n';
    code+=(m[1]==='='||m[1]==='-'?'out+=('+m[2]+');':m[2])+'\n';
    end=m.index+m[0].length;
  }
  code+='out+='+JSON.stringify(source.slice(end))+';\nout;';
  const ctx={
    getMessageVar:(path,options={})=>path in values?values[path]:options.defaults,
    getChatMessages:n=>chat.slice(n),
    Math:Object.assign(Object.create(Math),{random:()=>0.25}),
  };
  const output=new vm.Script(code).runInNewContext(ctx);
  return {output,ctx};
}
const defaults={'stat_data.地点.世界':'冥界','stat_data.地点.地域':'冥界','stat_data.地点.具体地点':'黄泉驿野-歇灯镇','stat_data.身份':[],'stat_data.修炼进度.境界':'炼气初期','stat_data.关系列表':{}};
const source=read(overviewPath);
const run=(v={},chat=[])=>render(source,{...defaults,...v},chat).output;
const base=run({'stat_data.地点.具体地点':'荒野'});
for(const world of ['凡界','灵界','仙界',''])check(run({'stat_data.地点.世界':world},['玄津宫','阴狱旧炉夹层']).trim()==='',world+'隐藏');
check(!base.includes('\\n'),'输出真实换行');
check(!base.includes('${'),'无未求值插值');
for(const n of ['characters','M','RES','ecoData','sectsData','kingsData','mapText'])check(source.includes('const '+n+' ='),n+'结构');
for(const p of people){
  check(base.includes(p.realm+' '+p.name+'('+p.appearanceType+')'),p.name+'初始名册');
  const known=run({'stat_data.地点.具体地点':'荒野','stat_data.关系列表':{[p.name]:{好感度:10}}});
  check(known.includes(p.title+': '+p.name+'('),p.name+'已知名片');
  check(!known.includes(p.realm+' '+p.name+'('),p.name+'已知去境界');
  check(!known.includes('外貌: '+p.race+'；'+p.look),p.name+'已知去外貌');
}
for(const m of secrets){
  check(!base.includes('### '+m.name+'\n'),m.name+'默认简报');
  const chat=run({'stat_data.地点.具体地点':'荒野'},[m.name]);
  check(!chat.includes('### '+m.name+'\n'),m.name+'聊天不展开');
  const at=run({'stat_data.地点.具体地点':m.eco+'-'+m.name});
  check(at.includes('### '+m.name+'\n'),m.name+'地点展开');
  for(const stage of m.stages)for(const cell of stage.slice(1))check(at.includes(cell),m.name+'四阶段正文');
  for(const other of secrets.filter(x=>x.name!==m.name))check(!at.includes('### '+other.name+'\n'),m.name+'不泄漏'+other.name);
}
for(const s of sects){
  check(!base.includes('### '+s.name+'·'),s.name+'非成员');
  for(const [realm,tier] of [['凡人','外门'],['元婴后期','外门'],['化神初期','内门'],['返虚中期','管事'],['炼虚后期','管事'],['合体初期','长老'],['渡劫后期','长老']]){
    const at=run({'stat_data.修炼进度.境界':realm,'stat_data.身份':[s.name+'弟子']});
    check(at.includes('### '+s.name+'·'+tier+'视角'),s.name+realm);
    for(const other of sects.filter(x=>x.name!==s.name))check(!at.includes('### '+other.name+'·'),s.name+'不串宗');
  }
  check(run({'stat_data.身份':s.name+'弟子'}).includes('### '+s.name+'·外门视角'),'字符串身份');
  check(!run({'stat_data.身份':[]},[s.name+'长老']).includes('### '+s.name+'·'),'聊天不授身份');
}
const captured=render(source.replace('const kingsData =','const kingsData = globalThis.__kings =').replace('const RES =','const RES = globalThis.__res ='),defaults).ctx;
for(const k of governments){
  const data=captured.__kings[k.name];
  const marker=k.body.split('\n').find(l=>l.startsWith('- 庇护交换'));
  check(!base.includes(marker),k.name+'默认简报');
  for(const kw of data.kws){check(run({'stat_data.地点.具体地点':'荒野'},[kw]).includes(marker),k.name+'关键词'+kw);}
}
for(const e of ecologies){
  const pool=captured.__res[e.name];
  check(pool.length>=3,e.name+'普通资源池');
  check(pool.every(r=>e.body.includes(r)),e.name+'资源源于蓝图');
}
for(const p of people){
  const src=read(p.file);
  check(render(src,defaults).output.trim()==='',p.group+'无命中');
  check(render(src,defaults,[p.name]).output.includes('身份: '+p.title),p.name+'未登场简介');
  check(!render(src,defaults,[p.group]).output.includes('### '+p.name),p.name+'宗门名不触发全员');
  for(const rel of [0,{好感度:20},{好感度:99},{道侣:true}]){
    const out=render(src,{...defaults,'stat_data.关系列表':{[p.name]:rel}}).output;
    check(out.includes(p.personality)&&out.includes(p.story),p.name+'已登场完整设定');
    check(!out.includes('外貌: '),p.name+'不重生外貌');
  }
}
// 角色卡登记与CSV：不改既有列序，不制造未完成的深写字段。
const config=YAML.parse(read('本格修仙.yaml'));
function objects(x){return x&&typeof x==='object'?[x,...Object.values(x).flatMap(objects)]:[];}
const entries=objects(config).filter(x=>x.名称&&x.文件);
for(const file of new Set([overviewPath,...people.map(p=>p.file)])){
  const matching=entries.filter(e=>String(e.文件).replaceAll('\\','/')===file.slice(0,-4));
  check(matching.length===1,'唯一登记'+file);
  check(matching[0].启用===true,'启用'+file);
  for(const p of people.filter(p=>p.file===file))check(matching[0].激活策略.关键字.includes(p.name),'外层关键词'+p.name);
}
function csv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if(c==='\n'&&!quoted){row.push(cell);rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(cell||row.length)rows.push([...row,cell]);
  return rows;
}
const castRows=csv(read('Doc/角色蓝图.csv'));
for(const p of people){const rows=castRows.filter(r=>r[0]===p.name);check(rows.length===1,p.name+'唯一CSV');check(rows[0].length===castRows[0].length,p.name+'CSV列数');check(rows[0][14]===p.realm&&rows[0][15]===String(p.age),p.name+'CSV境界年龄');}
const secretRows=csv(read('Doc/秘境清单.csv'));
for(const m of secrets){const rows=secretRows.filter(r=>r[2]===m.name);check(rows.length===1,m.name+'唯一CSV');check(rows[0].length===secretRows[0].length,m.name+'CSV列数');}
for(const[file,generated]of artifacts())check(read(file)===generated,'生成器无漂移'+file);

// 非冥界分支必须与原版本一致；冥界不落回凡界背景或跨大陆交通。
for(const file of ['世界层级.txt','世界设定-世界观.txt','世界设定-修为境界.txt','世界设定-经济系统.txt','[突破规则].txt']){
  const path='世界书/'+file,now=read(path),old=execFileSync('git',['show','HEAD:'+path],{encoding:'utf8'}).replace(/\r\n/g,'\n');
  for(const world of ['凡界','灵界','仙界'])for(const realm of ['凡人','金丹后期','化神后期','渡劫后期']){
    const vars={...defaults,'stat_data.地点.世界':world,'stat_data.修炼进度':{境界:realm},'stat_data.修炼进度.境界':realm};
    assert.equal(render(now,vars).output.trim(),render(old,vars).output.trim(),file+'保持'+world+realm); checks++;
  }
  const out=render(now,defaults).output;
  check(!out.includes('三千年后')&&!out.includes('虚海飞舟船票'),file+'冥界独立');
}
const breakthrough=read('世界书/[突破规则].txt');
for(const realm of ['化神后期','返虚后期','合体后期','大乘后期'])check(render(breakthrough,{...defaults,'stat_data.修炼进度':{境界:realm}}).output.includes('冥界无天劫'),realm+'无天劫');
const cap=render(breakthrough,{...defaults,'stat_data.修炼进度':{境界:'渡劫后期'}}).output;
check(cap.includes('冥界无法飞升')&&!cap.includes('突破成功结算'),'上限不输出越界结算');
const core=read('世界书/[核心系数总表].txt');check(!core.includes('E_realm'),'系数仍在修为获取');
for(const [w,d]of Object.entries({凡界:2,灵界:6,仙界:10,冥界:0.5}))check(render(read('世界书/[修为获取规则].txt'),{...defaults,'stat_data.地点.世界':w}).output.includes(`[E_realm] = ( ${d} / L)^2`),w+'系数');
check(read('世界书/[轮回转生规则].txt')===execFileSync('git',['show','HEAD:世界书/[轮回转生规则].txt'],{encoding:'utf8'}).replace(/\r\n/g,'\n'),'轮回规则未变');
console.log(`PASS: ${checks} checks; 40 people / 15 secrets / 60 stages; world isolation, routing, tiers, YAML, CSV, global branches and generation.`);
