import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {chatRuntime,pluginSourcePath} from './ejs_chat_runtime.mjs';
const require=createRequire(resolve('../tavern_helper_template-main/package.json'));
const YAML=require('yaml'),ts=require('typescript'),z=require('zod').z,_=require('lodash');
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const ejsModule={exports:{}};
new vm.Script(read(pluginSourcePath.replace('function/chat.ts','3rdparty/ejs.js'))).runInNewContext({module:ejsModule,exports:ejsModule.exports});
let checks=0;
const ok=(v,m)=>{assert(v,m);checks++;};
const base={'stat_data.地点.世界':'地球','stat_data.地点.地域':'中国','stat_data.地点.具体地点':'北京-华夏修真科学技术大学','stat_data.时间':{年:7026,月:1,日:1},'stat_data.关系列表':{},'stat_data.修炼进度.境界':'炼气初期'};
function render(src,vars={},messages=[]){
  const values={...base,...vars};
  return ejsModule.exports.render(src,{getMessageVar:(k,o={})=>k in values?values[k]:o.defaults,...chatRuntime(messages)});
}
const config=YAML.parse(read('本格修仙.yaml'));
const entries=config.条目.filter(e=>e.文件?.startsWith('世界书\\地球\\'));
ok(entries.length===11,'总览、凡界简述与九个人物条目登记');
for(const e of entries){
  const src=read(e.文件.replaceAll('\\','/')+'.txt');
  for(const world of ['凡界','灵界','冥界','仙界'])ok(render(src,{'stat_data.地点.世界':world}).trim()==='',e.名称+'不串界');
  ok(!render(src).includes('\\n'),e.名称+'真实换行');
  ok(e.插入位置.顺序===(e.名称.includes('人物-')?200:e.名称.includes('地区-')||e.名称.includes('地球版凡界简述')?53:52),'正确顺序');
  ok(e.递归.不可激活其他条目,'禁止名册递归激活所有人物');
}
const region=()=>read('世界书/地球/[mvu_plot]地球总览.txt');
const overview=region();
const initialEarth=render(overview);
ok(initialEarth.includes('<region_information region="地球">'),'统一总览容器');
ok(render(overview,{'stat_data.地点.地域':'修科大','stat_data.地点.具体地点':'修科大报到处'}).includes('国家仙道发展与改革委员会'),'简称识别当前地区');
ok(entries.find(e=>e.名称==='[mvu_plot]人物-地球-中国').激活策略.关键字.includes('修科大'),'简称激活人物条目');
ok(initialEarth.includes('国家仙道发展与改革委员会')&&!initialEarth.includes('永约救赎资本经营修行学贷'),'当前组织详情与异地简介');
ok(!initialEarth.includes('学生带样品上课'),'未提及异地城市只显示简介');
ok(render(overview,{},['罗马']).includes('学生带样品上课'),'聊天关键词展开城市');
ok(!render(overview,{},['罗马',...Array(15).fill('无关')]).includes('学生带样品上课'),'城市仅扫描最近十条');
ok(!render(overview,{},['龙门']).includes('分流石室'),'聊天不展开秘境内部');
for(const name of ['日本','俄罗斯','以色列','中东','印度','非洲']) {
  const out=render(overview,{'stat_data.地点.地域':name,'stat_data.地点.具体地点':'市区'});
  ok(out.includes('### '+name)&&out.includes('#### 主要人物'),name+'组织详情与人物名册');
}
const date=s=>{const[y,m,d]=s.split('-').map(Number);return{年:y,月:m,日:d};};
const siteData=vm.runInNewContext(overview.slice(overview.indexOf('  const M ='),overview.indexOf('  // 当前地区详情'))+'\nM;');
const rosterData=vm.runInNewContext(overview.slice(overview.indexOf('  const characters ='),overview.indexOf('  const countriesData ='))+'\ncharacters;');
const countries=vm.runInNewContext(overview.slice(overview.indexOf('  const countriesData ='),overview.indexOf('  const citiesData ='))+'\ncountriesData;');
const cities=vm.runInNewContext(overview.slice(overview.indexOf('  const citiesData ='),overview.indexOf('  const M ='))+'\ncitiesData;');
ok(Object.keys(countries).length===9&&Object.keys(cities).length===10,'九地区、十城市');
ok(!cities['洛阳']&&!cities['海法']&&!!cities['耶路撒冷'],'移除洛阳城市、以色列改为耶路撒冷');
const assigned=Object.values(countries).flatMap(c=>c.roster);
ok(assigned.length===49&&new Set(assigned).size===49,'每名人物只属于一组名册');
for(const [name,country] of Object.entries(countries)){
  ok(country.detail&&country.roster.every(n=>rosterData[n]),name+'组织与名册完整');
  for(const alias of country.kws){
    const out=render(overview,{'stat_data.地点.地域':alias,'stat_data.地点.具体地点':alias});
    ok(out.includes(country.detail),alias+'地区别名路由');
  }
}
for(const [name,city] of Object.entries(cities)){
  const out=render(overview,{'stat_data.地点.地域':'','stat_data.地点.具体地点':name});
  ok(out.includes(city.detail)&&out.includes(countries[city.region].detail),name+'仅具体地点识别地区与城市');
}
ok(!overview.includes('<event name="地球名胜探索">'),'保留用户删除事件块的精修');
ok(!overview.includes('主要修行派系:'),'六地区占位简介已补全');
ok(Object.keys(siteData).length===16,'十六处名胜');
for(const [name,site] of Object.entries(siteData)){
  ok(!['open','warning','notice','sign'].some(key=>key in site),name+'无日期解锁字段');
  ok(site.brief.includes('入口:')&&site.detail.includes('顺序:'),name+'统一秘境格式');
  for(const label of ['险:','解:','获:'])ok(site.detail.split(label).length===5,name+'四阶段'+label);
  for(const person of Object.keys(rosterData))ok(!site.detail.includes(person)&&!site.brief.includes(person),name+'不含'+person);
  const vars={'stat_data.地点.地域':site.region,'stat_data.地点.具体地点':name};
  for(const year of [7025,7026,7050])ok(render(overview,{...vars,'stat_data.时间':{年:year,月:1,日:1}}).includes(site.detail),name+'详情不按年份解锁');
  const remote=render(overview,{'stat_data.地点.地域':site.region,'stat_data.地点.具体地点':'市区'},[name]);
  ok(remote.includes(site.brief)&&!remote.includes(site.detail),name+'聊天提及只显示简介');
  const revisit=render(overview,{...vars,'stat_data.事件.进度.地球名胜':{[name]:'已勘测；样本已取走'}});
  ok(revisit.includes('已勘测；样本已取走'),name+'回访保留记录');
}
for(const [alias,expected] of [['圣钥大学','欧洲协和圣约理事会'],['蒙恩大学','永约救赎资本']]){
  ok(render(overview,{'stat_data.地点.地域':alias,'stat_data.地点.具体地点':alias}).includes(expected),alias+'简称路由');
}
let count=0;
for(const e of entries.filter(e=>e.名称.includes('人物-'))){
  const src=read(e.文件.replaceAll('\\','/')+'.txt');
  const names=[...src.matchAll(/^  "([^"]+)": \{/gm)].map(m=>m[1]);
  count+=names.length;
  for(const n of names){
    ok(e.激活策略.关键字.includes(n),n+'外层入口');
    const hit=render(src,{},[n]);
    ok(hit.includes('### '+n)&&!hit.includes('底色:'),n+'moderate');
    ok(!render(src,{},[n,...Array(15).fill('无关')]).includes('### '+n),n+'只扫描最近十条');
    for(const rel of [0,{好感度:20},{好感度:99},{道侣:true}])ok(render(src,{'stat_data.关系列表':{[n]:rel}}).includes('底色:'),n+'detail');
    const r=e.名称.split('-').at(-1);
    const known=render(region(r),{'stat_data.地点.地域':r,'stat_data.关系列表':{[n]:{好感度:20}}});
    ok(!new RegExp('(?:元婴|金丹|筑基|炼气|凡人)(?:初期|中期|后期)? '+n).test(known),n+'已知不重复初始境界');
  }
}
ok(count===49,'49个人物');
const generation=read('世界书/[角色生成规则].txt');
const generated=render(generation);
ok(generated.includes('地球修仙者B=100，其余B=寿命'),'年龄备注区分两种公式');
ok(!generation.includes('地球场景')&&generated.includes('人物姓名符合所在国家文化'),'取消地球专用分支，姓名按国家文化');
ok(render(generation,{'stat_data.地点.世界':'凡界'}).includes('其余B=寿命'),'其他界域年龄公式保留');
const csv=read('Doc/世界书设定相关/角色蓝图.csv').trimEnd().split('\n');
ok(csv.slice(-49).every(l=>l.includes(',地球,')),'49行角色蓝图登记');
const cultivation=read('世界书/[修为获取规则].txt');
for(const [d,coefficient] of [['7026-01-01',1],['7028-01-01',2.49897331],['7030-01-01',4],['7050-01-01',43.2],['7080-01-01',43.2]]){
  const out=render(cultivation,{'stat_data.时间':date(d)});
  const actual=Number(out.match(/\[E_realm\] = ([\d.]+) \/ L\^2/)[1]);
  // 中点按实际日数插值（7028年起始前累计730天，总1461天）。
  ok(Math.abs(actual-coefficient)<1e-8,d+'灵气系数');
}
ok(!render(cultivation,{'stat_data.修炼进度.境界':'凡人'}).includes('[E_realm]'),'凡人无除零公式');
ok(render(cultivation,{'stat_data.时间':date('7025-01-01')}).includes('未设定'),'不外推未批准历史曲线');
for(const [w,d] of [['凡界',2],['灵界',6],['冥界',0.5],['仙界',10]])ok(render(cultivation,{'stat_data.地点.世界':w}).includes(`( ${d} / L)^2`),w+'常数保持');
for(const file of ['世界层级','世界设定-世界观','世界设定-修为境界','世界设定-经济系统','世界设定-伦理']){
  const output=render(read('世界书/'+file+'.txt'));
  ok(!output.includes('undefined')&&!output.includes('NaN'),file+'输出有效');
  ok(!output.includes('三妻四妾')&&!output.includes('不屑于干涉凡人'),file+'地球未落入凡界社会');
}
// 同时执行卡内与前端实际 Zod Schema，不仅检查枚举文本。
let cardSource=read('脚本/变量结构.js').replace(/^import .*;\n/,'').replace('export const Schema','const Schema');
const card=new vm.Script(cardSource+'\nSchema;').runInNewContext({z,_,YAML,eventOn:()=>{},$:()=>{},console});
const arraySrc=ts.transpileModule(read('../tavern_helper_template-main/util/string-array.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const arrayModule={exports:{}};
new Function('module','exports','require',arraySrc)(arrayModule,arrayModule.exports,require);
const frontSrc=ts.transpileModule(read('../tavern_helper_template-main/src/修仙状态栏/schema.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const frontModule={exports:{}};
new Function('module','exports','require','_',frontSrc)(frontModule,frontModule.exports,k=>k.includes('string-array')?arrayModule.exports:k.includes('cultivation-calendar')?require('./util/cultivation-calendar.js'):require(k),_);
for(const [label,schema] of [['卡内',card],['前端',frontModule.exports.Schema]])for(const w of ['地球','冥界','凡界','灵界','仙界']){
  const input={地点:{世界:w,地域:'中国',具体地点:'北京'},固定资产:{住处:{所在地:`${w}·中国·北京`}},时间:{年:7026,月:1,日:1,时辰:'午时'}};
  const result=schema.parse(input);
  ok(result.地点.世界===w,label+w+'地点保留');
  ok(result.固定资产.住处.所在地.世界===w,label+w+'资产保留');
  ok(JSON.stringify(schema.parse(result))===JSON.stringify(result),label+w+'幂等');
  const progress=schema.parse({...input,事件:{进度:{地球名胜:{'龙门·回澜石窟':'完成救援，阵件已移交'}}}});
  ok(progress.事件.进度.地球名胜['龙门·回澜石窟']==='完成救援，阵件已移交',label+'探索记录持久化');
}
// 所有新条目与全局分支拼接，验证块作用域。
render(entries.map(e=>read(e.文件.replaceAll('\\','/')+'.txt')).join('\n')+'\n'+cultivation);
ok(true,'拼接求值无重声明');
console.log(`PASS: ${checks} Earth routing, dates, NPCs, coefficients, registration and schema checks.`);
