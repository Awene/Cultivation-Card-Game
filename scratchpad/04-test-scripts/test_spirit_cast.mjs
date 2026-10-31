import assert from 'node:assert/strict';
import vm from 'node:vm';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {sources,regions,read} from './spirit_cast_sources.mjs';
import {cast,groupBy,renderGroup,parseCSV} from './build_spirit_cast.mjs';
import {moderateOf,detailOf} from './spirit_character_template.mjs';
import {chatRuntime} from './ejs_chat_runtime.mjs';

let checks=0;
const ok=(v,m)=>{assert(v,m);checks++;};
const all=regions.flatMap(cast);
const files=[];
const require=createRequire(resolve('../tavern_helper_template-main/package.json'));
const config=require('yaml').parse(read('本格修仙.yaml'));
const entries=config.条目.filter(e=>e.文件?.startsWith('世界书\\灵界\\')&&e.文件.includes('\\人物\\'));
const reference=read('世界书/凡界/南疆/人物/[mvu_plot]人物-南疆-千形宗.txt');
const prelude=s=>s.slice(s.indexOf('const 人物关系'),s.indexOf('const C = {'));
const tail=s=>s.slice(s.indexOf('const renderChar')).trimEnd();
const compile=s=>{
  let code='let rendered="";\n';
  for(const m of s.matchAll(/<%([_=\-]?)([\s\S]*?)([_\-]?)%>/g))
    code+=['-','='].includes(m[1])?'rendered+=('+m[2]+');\n':m[2]+'\n';
  return new vm.Script(code+'\nrendered;');
};
const run=(program,messages=[],relations={},location='',api=true)=>program.runInNewContext({
  getMessageVar:k=>({
    'stat_data.关系列表':relations,
    'stat_data.地点.具体地点':location,
    'stat_data.地点.世界':'灵界',
    'stat_data.地点.地域':'其他大陆',
  }[k]),
  ...(api?chatRuntime(messages):{}),
},{timeout:3000});

for(const region of regions)for(const [group,ps] of groupBy(all.filter(p=>p.region===region))){
  const path=ps[0].path,source=read(path),program=compile(source);
  files.push({path,source});
  ok(source===renderGroup(region,group,ps),path+'生成一致');
  ok(prelude(source)===prelude(reference)&&tail(source)===tail(reference),path+'凡界路由一致');
  const C=vm.runInNewContext('('+source.match(/const C = (\{[\s\S]*?\n\});/)[1]+')');
  ok(!/knownBrief|sourceProfile|spirit_characters|写作边界：|连续性：/.test(source),path+'无旧包装');
  ok(run(program)==='',group+'未知且无关键词静默');
  for(const p of ps){
    const c=C[p.name];
    ok(JSON.stringify(Object.keys(c))===JSON.stringify(['kws','locationKws','moderate','detail','表白','道侣']),p.name+'六字段');
    ok(c.kws.includes(p.name)&&Array.isArray(c.locationKws),p.name+'关键词');
    ok(run(program,[p.name])===c.moderate,p.name+'未知点名只给简介');
    ok(run(program,[p.name,...Array(20).fill('无关')])==='',p.name+'旧人名不触发');
    ok(run(program,[],{[p.name]:{好感度:80}})===c.detail,p.name+'已知无需再次点名且80不表白');
    ok(run(program,[],{[p.name]:null})===c.detail,p.name+'空关系值仍视为已有');
    ok(run(program,[],{[p.name]:81})===c.detail+'\n\n'+c.表白,p.name+'数字关系');
    ok(run(program,[],{[p.name]:{好感度:81}})===c.detail+'\n\n'+c.表白,p.name+'大于80表白');
    for(const relation of [{道侣:true},{关系:'道侣'},{关系类型:'道侣'}])
      ok(run(program,[],{[p.name]:{好感度:99,...relation}})===c.detail+'\n\n'+c.道侣,p.name+'道侣优先');
    ok(run(program,[],{[p.name]:{好感度:0}},'',false)===c.detail,p.name+'已知不依赖聊天API');
    for(const loc of c.locationKws){
      ok(run(program,[],{},loc).includes(c.moderate),p.name+'实际地点触发');
      if(!c.kws.some(k=>loc.includes(k)))ok(!run(program,[loc]).includes(c.moderate),p.name+'聊天地名不冒充到达');
    }
    ok(c.moderate===moderateOf(p)&&c.detail===detailOf(p),p.name+'创作源一致');
    ok(!/成年|初始境界|实际年龄/.test(c.moderate),p.name+'简介无额外年龄声明');
    const e=entries.find(e=>e.文件===p.path.replaceAll('/','\\').replace(/\.txt$/,''));
    ok(e&&c.kws.every(k=>e.激活策略.关键字.includes(k)),p.name+'YAML姓名入口');
    ok(c.locationKws.every(k=>e.激活策略.关键字.includes(k)),p.name+'YAML地点入口');
  }
  if(ps.length>1){
    const [a,b]=ps;
    ok(run(program,[b.name],{[a.name]:{好感度:0}})===C[a.name].detail+'\n\n'+C[b.name].moderate,
      group+'已知详情与未知简介并列');
  }
}
ok(entries.length===files.length,'YAML与文件数量');
for(const e of entries){
  ok(existsSync(e.文件+'.txt'),e.名称+'存在');
  ok(e.启用===true&&e.激活策略.类型==='绿灯'&&e.插入位置.顺序===200&&e.特殊效果.黏性===5&&e.递归.不可激活其他条目===true,e.名称+'配置');
}
const rows=parseCSV(read('Doc/角色蓝图.csv')),header=rows[0];
ok(rows.every(r=>r.length===header.length),'CSV列数');
const spirit=rows.slice(1).filter(r=>r[header.indexOf('世界')]==='灵界');
ok(spirit.length===all.length,'CSV人数');
for(const p of all){
  const row=spirit.find(r=>r[0]===p.name&&r[header.indexOf('大陆')]===p.region);
  ok(row&&row[header.indexOf('人物世界书文件')]===p.path,p.name+'CSV映射');
  for(const [field,value] of Object.entries({
    '性格底色':p.deep.core,
    '性格特征A':p.deep.traits[0].name,
    '性格A场景':p.deep.traits[0].scenes.map((s,i)=>(i+1)+'. '+s).join('\n'),
    '性格特征B':p.deep.traits[1].name,
    '性格B场景':p.deep.traits[1].scenes.map((s,i)=>(i+1)+'. '+s).join('\n'),
    '主动表白':p.deep.confession,
    '道侣相处':p.deep.partner.map((s,i)=>(i+1)+'. '+s).join('\n'),
  }))ok(row[header.indexOf(field)]===value,p.name+'CSV '+field);
}
const combined=compile([...Object.values(sources).map(s=>s.source),...files.map(f=>f.source)].join('\n'));
const rendered=run(combined,[],{[all[0].name]:{好感度:0}});
ok(rendered.includes(detailOf(all[0])),'总览和全部人物联合编译');
console.log(JSON.stringify({checks,people:all.length,files:files.length,template:'凡界 moderate/detail',status:'PASS'},null,2));
