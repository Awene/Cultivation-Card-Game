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
const base={'stat_data.地点.世界':'地球','stat_data.地点.地域':'中国','stat_data.地点.具体地点':'北京-东风修仙基地','stat_data.时间':{年:7026,月:1,日:1},'stat_data.关系列表':{},'stat_data.修炼进度.境界':'炼气初期'};
function render(src,vars={},messages=[]){
  const values={...base,...vars};
  return ejsModule.exports.render(src,{getMessageVar:(k,o={})=>k in values?values[k]:o.defaults,...chatRuntime(messages)});
}
const config=YAML.parse(read('本格修仙.yaml'));
const entries=config.条目.filter(e=>e.文件?.startsWith('世界书\\地球\\'));
ok(entries.length===7,'7个正式条目登记');
for(const e of entries){
  const src=read(e.文件.replaceAll('\\','/')+'.txt');
  for(const world of ['凡界','灵界','冥界','仙界'])ok(render(src,{'stat_data.地点.世界':world}).trim()==='',e.名称+'不串界');
  ok(!render(src).includes('\\n'),e.名称+'真实换行');
  ok(e.插入位置.顺序===(e.名称.includes('人物-')?200:e.名称.includes('地区-')?53:52),'正确顺序');
  ok(e.递归.不可激活其他条目,'禁止名册递归激活所有人物');
}
const region=p=>read(`世界书/地球/地区/[mvu_plot]地区-地球-${p}.txt`);
const future=[['中国','嵩山·中岳星台','7026-03-14','7026-03-21','7026-03-23','山径定向'],['欧盟','圣米歇尔·潮钟回廊','7026-06-07','7026-06-14','7026-06-16','岸边接应'],['英美','德比码头·雾帆仓','7026-09-26','7026-10-03','7026-10-05','雾岸寻路']];
const date=s=>{const[y,m,d]=s.split('-').map(Number);return{年:y,月:m,日:d};};
for(const [r,n,warning,open,notice,stage] of future){
  const v={'stat_data.地点.地域':r,'stat_data.地点.具体地点':n};
  const src=region(r),initial=render(src,v,[n]);
  ok(!initial.includes(n)&&!initial.includes(stage),n+'开局及聊天不提前揭示');
  ok(!/7026-0[369]/.test(initial),n+'不输出未来日期');
  const sign=render(src,{...v,'stat_data.时间':date(warning)});
  ok(sign.includes('异常报告')&&!sign.includes(stage),n+'征兆未开放');
  const active=render(src,{...v,'stat_data.时间':date(open)});
  ok(active.includes(stage)&&!active.includes('已发布调查与协作招募'),n+'开放边界');
  ok(render(src,{...v,'stat_data.时间':date(notice)}).includes('已发布调查与协作招募'),n+'招募边界');
  const later=render(src,{...v,'stat_data.时间':date('7027-01-01'),'stat_data.事件.进度.地球名胜':{[n]:'已救援；样本由同伴保管'}});
  ok(later.includes('已救援；样本由同伴保管'),n+'回访沿用记录');
  ok(!render(src,{...v,'stat_data.时间':date(open),'stat_data.地点.具体地点':'市区'}).includes(stage),n+'不在场只简报');
  for(const other of ['中国','欧盟','英美'].filter(x=>x!==r))ok(!render(src,{'stat_data.地点.地域':other}).trim(),r+'不输出到'+other);
}
for(const [r,place,stage] of [['中国','龙门','分流石室'],['欧盟','奥斯蒂亚','旧库清障'],['英美','沃伦堡','失控防护室']]){
  ok(render(region(r),{'stat_data.地点.地域':r,'stat_data.地点.具体地点':place}).includes(stage),place+'初始探索');
}
let count=0;
for(const e of entries.filter(e=>e.名称.includes('人物-'))){
  const src=read(e.文件.replaceAll('\\','/')+'.txt');
  const names=[...src.matchAll(/^  "([^"]+)": \{/gm)].map(m=>m[1]);
  count+=names.length;
  for(const n of names){
    ok(e.激活策略.关键字.includes(n),n+'外层入口');
    const hit=render(src,{},[n]);
    ok(hit.includes('### '+n)&&!hit.includes('性格与生活:'),n+'moderate');
    ok(!render(src,{},[n,...Array(15).fill('无关')]).includes('### '+n),n+'只扫描最近十条');
    for(const rel of [0,{好感度:20},{好感度:99},{道侣:true}])ok(render(src,{'stat_data.关系列表':{[n]:rel}}).includes('性格与生活:'),n+'detail');
    const r=e.名称.split('-').at(-1);
    const known=render(region(r),{'stat_data.地点.地域':r,'stat_data.关系列表':{[n]:{好感度:20}}});
    ok(!new RegExp('(?:元婴|金丹|筑基|炼气|凡人)(?:初期|中期|后期)? '+n).test(known),n+'已知不重复初始境界');
  }
}
ok(count===22,'22个人物');
const generation=read('世界书/[角色生成规则].txt');
const generated=render(generation);
ok(generated.includes('地球修仙者B=100，其余B=寿命'),'年龄备注区分两种公式');
ok(!generation.includes('地球场景')&&generated.includes('人物姓名符合所在国家文化'),'取消地球专用分支，姓名按国家文化');
ok(render(generation,{'stat_data.地点.世界':'凡界'}).includes('其余B=寿命'),'其他界域年龄公式保留');
const csv=read('Doc/世界书设定相关/角色蓝图.csv').trimEnd().split('\n');
ok(csv.slice(-22).every(l=>l.includes(',地球,')),'22行角色蓝图登记');
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
