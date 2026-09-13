import assert from 'node:assert/strict';
import vm from 'node:vm';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {sources,regions,read} from './spirit_cast_sources.mjs';
import {cast,groupBy,renderGroup,parseCSV} from './build_spirit_cast.mjs';
import {chatRuntime} from './ejs_chat_runtime.mjs';
let checks=0;
const ok=(v,m)=>{assert(v,m);checks++;};
function compile(src){
  let code='let rendered="";\n';
  for(const m of src.matchAll(/<%([_=\-]?)([\s\S]*?)([_\-]?)%>/g))code+=['-','='].includes(m[1])?'rendered += ('+m[2]+');\n':m[2]+'\n';
  return new vm.Script(code+'\nrendered;');
}
function run(program,region,loc='',messages=[],relations={},world='灵界',api=true){
  const vars={'stat_data.地点.世界':world,'stat_data.地点.地域':region,'stat_data.地点.具体地点':loc,'stat_data.关系列表':relations};
  const calls=[];
  const ctx={getMessageVar:k=>vars[k]};
  if(api){const actual=chatRuntime([...Array(30).fill('无关旧消息'),...messages]);ctx.getChatMessages=(...args)=>{
    calls.push(args);assert.deepEqual(args,[-10]);return actual.getChatMessages(...args);
  };}
  return {output:program.runInNewContext(ctx,{timeout:3000}),calls};
}
const yaml=read('本格修仙.yaml'),all=[],files=[];
const draft=process.argv.includes('--draft');
const countryKeys=new Set(parseCSV(read('Doc/灵界凡国设定清单.csv')).slice(1).map(row=>row[0]+'/'+row[1]));
for(const r of regions){
  if(!existsSync('scratchpad/cast-'+r+'.json')){assert(draft,'missing '+r);continue;}
  let people;
  try{people=cast(r,{partial:draft});}catch(e){if(draft){console.log('待核对',r,e.message);continue;}throw e;}
  all.push(...people);
  for(const p of people.filter(p=>countryKeys.has(p.region+'/'+p.group))){
    ok(/^(凡人|炼气|练气|筑基|金丹)/.test(p.c.realm),p.name+'凡国分组境界上限');
  }
  for(const [group,ps] of groupBy(people)){
    const path=ps[0].path,source=draft?renderGroup(r,group,ps):read(path);
    const program=compile(source);files.push({path,source,program});
    ok(source===renderGroup(r,group,ps),path+'素材同步');
    ok(!source.includes('鲛人')&&!source.includes('玄黄大陆'),path+'统一命名');
    ok(run(program,r).output==='',group+'不命中不输出');
    ok(run(program,r,group,[],{},'凡界').output==='',group+'世界隔离');
    const groupOnly=run(program,r,group).output;
    ok(groupOnly.includes('人物名册')&&!groupOnly.includes('### '),group+'仅名册');
    ok(run(program,r,group,[],{},'灵界',false).output.includes('人物名册'),group+'无API按地点');
    for(const p of ps){
      const only=run(program,r,'',[p.name]).output;
      ok(only.includes('### '+p.name)&&only.includes(p.deep?.core || p.voice)&&only.includes(p.c.realm),p.name+'个人详情');
      for(const q of ps.filter(q=>q.name!==p.name))ok(!only.includes('### '+q.name),p.name+'不展开'+q.name);
      const seen=run(program,r,'',[p.name],{[p.name]:{境界:'已变化'}}).output;
      ok(!seen.includes('- 初始境界：')&&!seen.includes('[已确定蓝图档案]'),p.name+'不重置');
      ok(seen.includes('当前境界、年龄、身份')&&seen.includes('不可把情境中的旧职务或修为重新当作当前值'),p.name+'性格情境不覆盖当前状态');
      ok(seen.includes('此人已经出场')&&seen.includes(p.deep?.traits[0].scenes[0] || p.habit),p.name+'保留生活参考');
      if(p.deep){
        ok(!only.includes('[表白]')&&!only.includes('[道侣相处]'),p.name+'未出场不输出恋爱阶段');
        const court=run(program,r,'',[p.name],{[p.name]:{好感度:81,道侣:false}}).output;
        const partner=run(program,r,'',[p.name],{[p.name]:{好感度:60,道侣:true}}).output;
        const boundary=run(program,r,'',[p.name],{[p.name]:{好感度:80,道侣:false}}).output;
        ok(court.includes(p.deep.confession)&&!court.includes('[道侣相处]'),p.name+'表白条件');
        ok(partner.includes(p.deep.partner[3])&&!partner.includes('[表白]'),p.name+'道侣条件');
        ok(!boundary.includes('[表白]')&&!boundary.includes('[道侣相处]'),p.name+'好感80不越过阈值');
        ok(!seen.includes('着装(外):')&&!seen.includes('着装(内):')&&!seen.includes('法宝:'),p.name+'既有人物不重置装备衣着');
        ok(!seen.includes('角色魅力:')&&!seen.includes('### '+p.name+' ('),p.name+'既有人物不重置外貌分类与形体魅力');
      }
      ok(run(program,'其他大陆','',[p.name]).output.includes('### '+p.name),p.name+'跨大陆点名');
      const both=run(program,r,group,[p.name]).output;
      ok(both.includes('### '+p.name),p.name+'混合触发');
      if(ps.length>1)ok(both.includes('[同组其他人物]'),p.name+'其余简报');
      ok(p.age&&p.gender&&p.category&&p.c.race&&p.c.realm,p.name+'元数据齐备');
      if(p.gender==='男')ok(p.category===p.c.appearanceType&&p.category!=='不适用',p.name+'保留男性外观分类');
      if(!draft)ok(yaml.includes('    文件: '+p.path.replaceAll('/','\\').replace(/\.txt$/,'')),p.name+'YAML已挂载');
    }
  }
}
ok(new Set(all.map(p=>p.region+'/'+p.name)).size===all.length,'大陆内姓名唯一');
for(const field of ['voice','habit','encounter','relationship','hook']){
  ok(new Set(all.map(p=>p[field])).size===all.length,field+'逐人不重复');
  for(const p of all)ok(p[field].length>=30,p.name+' '+field+'有具体内容');
}
if(files.length){
  const combined=compile(files.map(f=>f.source).join('\n'));
  const first=all[0];ok(run(combined,first.region,'',[first.name]).output.includes('### '+first.name),'全文件合并编译无变量冲突');
  const withOverviews=compile([...Object.values(sources).map(s=>s.source),...files.map(f=>f.source)].join('\n'));
  const ctx={getMessageVar:k=>({'stat_data.地点.世界':'灵界','stat_data.地点.地域':first.region}[k]),...chatRuntime([first.name])};
  ok(withOverviews.runInNewContext(ctx,{timeout:5000}).includes('<spirit_characters'),'六份总览与全人物联合运行');
}
if(!draft){
  const require=createRequire(resolve('../tavern_helper_template-main/package.json'));
  const config=require('yaml').parse(yaml);
  const entries=config.条目.filter(e=>e.文件?.startsWith('世界书\\灵界\\')&&e.文件.includes('\\人物\\'));
  ok(entries.length===files.length,'YAML解析与文件计数');
  ok(new Set(entries.map(e=>e.名称)).size===entries.length,'条目名称唯一');
  for(const e of entries){
    ok(e.启用===true&&e.激活策略.类型==='绿灯'&&e.插入位置.顺序===200&&e.特殊效果.黏性===5&&e.递归.不可激活其他条目===true,e.名称+'配置参数');
    ok(existsSync(e.文件+'.txt'),e.名称+'文件存在');
  }
  const rows=parseCSV(read('Doc/角色蓝图.csv')),header=rows[0];
  ok(rows.every(row=>row.length===header.length),'CSV列数一致');
  const spirit=rows.slice(1).filter(row=>row[header.indexOf('世界')]==='灵界');
  ok(spirit.length===all.length,'CSV人物全覆盖');
  // 固定扩写前基线，提交新人物后也继续验证原有凡界资料未丢失。
  const baseline='eb31138cbb5c7dccb01284adb9276a15174b8561';
  const original=parseCSV(execFileSync('git',['show',baseline+':Doc/角色蓝图.csv'],{encoding:'utf8'}).replace(/\r\n/g,'\n'));
  ok(new Set([...original.slice(1).map(row=>row[0]),...all.map(p=>p.name)]).size===original.length-1+all.length,'凡界与灵界人物名不冲突');
  for(const row of original.slice(1))ok(rows.slice(1).some(now=>JSON.stringify(now.slice(0,11))===JSON.stringify(row.slice(0,11))),row[0]+'凡界原始字段保留');
  for(const path of ['Doc/宗门设定清单.csv','Doc/秘境清单.csv']){
    const old=parseCSV(execFileSync('git',['show',baseline+':'+path],{encoding:'utf8'}).replace(/\r\n/g,'\n'));
    const now=parseCSV(read(path));
    for(const row of old.slice(1))ok(now.some(n=>JSON.stringify(n)===JSON.stringify(row)),path+'原条目保留 '+row[1]);
  }
  for(const p of all){
    const row=spirit.find(row=>row[0]===p.name&&row[header.indexOf('大陆')]===p.region);
    ok(row&&row[header.indexOf('人物世界书文件')]===p.path,p.name+'CSV映射');
    for(const [field,value] of Object.entries({'种族':p.c.race,'初始境界':p.c.realm,'实际年龄':p.age,'身份职责':p.c.title}))ok(row[header.indexOf(field)]===value,p.name+'CSV '+field);
    if(p.deep){
      const expected={'性格底色':p.deep.core,'性格特征A':p.deep.traits[0].name,'性格A场景':p.deep.traits[0].scenes.map((s,i)=>(i+1)+'. '+s).join('\n'),'性格特征B':p.deep.traits[1].name,'性格B场景':p.deep.traits[1].scenes.map((s,i)=>(i+1)+'. '+s).join('\n'),'主动表白':p.deep.confession,'道侣相处':p.deep.partner.map((s,i)=>(i+1)+'. '+s).join('\n')};
      for(const [field,value] of Object.entries(expected))ok(row[header.indexOf(field)]===value,p.name+'CSV 深写 '+field);
      for(const [i,value] of [[5,p.charm],[7,p.outer],[8,p.inner],[9,p.personality],[10,p.artifact]])ok(row[i]===value,p.name+'CSV 覆盖旧短稿 '+i);
    }
  }
  const sectRows=parseCSV(read('Doc/宗门设定清单.csv')).slice(1).filter(row=>regions.includes(row[0]));
  ok(sectRows.length===43,'42宗门及1机构');
  for(const p of all){const row=sectRows.find(row=>row[0]===p.region&&row[1]===p.group);if(row)ok(row[5].includes(p.name),p.name+'宗门清单已登记人设');}
  const secretRows=parseCSV(read('Doc/秘境清单.csv')).slice(1).filter(row=>regions.includes(row[0]));
  ok(secretRows.length===144,'144秘境');
  const countries=parseCSV(read('Doc/灵界凡国设定清单.csv')).slice(1);
  ok(countries.length===33,'33凡国');
  const realmOrder=['凡人','炼气','筑基','金丹','元婴','化神','返虚','合体','大乘','渡劫'];
  for(const p of all.filter(p=>countries.some(row=>row[0]===p.region&&row[1]===p.group))){
    const rank=realmOrder.findIndex(r=>p.c.realm.includes(r));ok(rank>=0&&rank<=3,p.name+'凡国境界上限');
  }
}
console.log(JSON.stringify({checks,people:all.length,files:files.length,draft,byRegion:regions.map(r=>({region:r,people:all.filter(p=>p.region===r).length,groups:groupBy(all.filter(p=>p.region===r)).size}))},null,2));
