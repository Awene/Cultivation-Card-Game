import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const path='世界书/灵界/殒落大陆/[mvu_plot]殒落大陆总览.txt';
const source=readFileSync(path,'utf8');
let checks=0;
const check=(value,label)=>{assert(value,label);checks++;};
function compile(text){
  let code='let rendered="";\n';
  for(const m of text.matchAll(/<%([_=\-]?)([\s\S]*?)([_\-]?)%>/g)){
    code+=['-','='].includes(m[1])?'rendered += ('+m[2]+');\n':m[2]+'\n';
  }
  return new vm.Script(code+'\nrendered;');
}
const library=source.match(/const fragments = (\[[\s\S]*?\n  \]);/);
check(!!library,'可读取分层碎片库');
const fragments=new vm.Script('('+library[1]+')').runInNewContext({});
const slots=Array.from(fragments,f=>f.name);
check(slots.length===24&&new Set(slots).size===24,'24个唯一正式碎片');
check(!source.includes('占用内容')&&!source.includes('框架阶段'),'无占用内容残留');
for(const f of fragments){
  check(f.brief.length>15&&f.detail.length>200,'简述及详情完整 '+f.name);
  check(!/魔族|天魔|朔灯|绛苇|【考古线索】|【潜在所得】/.test(f.brief),'远观不揭示历史与内部 '+f.name);
  for(const field of ['【类型】','【落脚与内部】','【探索与取舍】','【考古线索】','【潜在所得】','【叙述者底稿】'])check(f.detail.includes(field),'详情字段 '+f.name+' '+field);
}
const original=compile(source);
// 仅在内存替换为独立标记，以精确测试错误匹配与未探索详情泄漏。
const marked=compile(source.replace(library[1],JSON.stringify(fragments.map(f=>({name:f.name,brief:'远观_'+f.name+'_结束',detail:'内部_'+f.name+'_结束'})))));
function run(program,vars={},seed=1){
  const defaults={'地点.世界':'灵界','地点.地域':'殒落大陆','地点.具体地点':'殒落大陆-折翼天阶-落脚处',...vars};
  const math=Object.create(Math);
  math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  return program.runInNewContext({Math:math,getMessageVar:key=>defaults[key.replace('stat_data.','')]},{timeout:1000});
}
check(run(original).includes(fragments[0].detail),'正式EJS执行成功');
for(const world of ['凡界','仙界','冥界','',null])check(run(marked,{'地点.世界':world})==='','非灵界为空');
for(const region of ['圣银大陆','星坠大陆','',null])check(run(marked,{'地点.地域':region})==='','其他大陆为空');
for(const n of slots){
  for(let seed=0;seed<30;seed++){
    const output=run(marked,{'地点.具体地点':`殒落大陆-${n}-内部-岔道`},seed);
    const candidates=[...output.matchAll(/<candidate_fragment slot="\d" name="([^"]+)">/g)].map(m=>m[1]);
    check(candidates.length===3&&new Set(candidates).size===3,'三个不重复候选');
    check(!candidates.includes(n),'排除当前碎片');
    check(output.includes('内部_'+n+'_结束'),'当前详情匹配');
    check((output.match(/内部_[^<\n]+_结束/g)||[]).length===1,'仅当前详情');
    check(candidates.every(c=>output.includes('远观_'+c+'_结束')),'候选只有对应简述');
    check((output.match(/远观_[^<\n]+_结束/g)||[]).length===3,'不输出全库简述');
  }
}
for(const location of ['',null,'殒落大陆','殒落大陆-未知碎片-入口','殒落大陆-折翼天阶旧址-入口','圣银大陆-折翼天阶-入口','殒落大陆-未知-折翼天阶','折翼天阶']){
  const output=run(marked,{'地点.具体地点':location});
  check(!output.includes('<current_fragment '),'失败时无详情标签');
  check(!output.includes('内部_'),'失败时无详情内容');
  check((output.match(/<candidate_fragment /g)||[]).length===3,'失败仍显示三个候选');
}
check(run(marked,{'地点.地域':' 陨落大陆 ','地点.具体地点':' 陨落大陆 - 余灯长街 - 入口 '}).includes('内部_余灯长街_结束'),'名称别字兼容与空白处理');
check(new Set(Array.from({length:30},(_,i)=>run(marked,{},i))).size>1,'不同随机状态产生不同候选');
check(run(marked,{},12)===run(marked,{},12),'固定随机状态可复现');
check(!source.includes('一千年前')&&!source.includes('圣战通行令'),'不继承旧占位设定');
for(const fragment of fragments){
  const output=run(original,{'地点.具体地点':`殒落大陆-${fragment.name}-入口`});
  check(output.includes(fragment.detail),'实际详情完整 '+fragment.name);
  for(const other of fragments.filter(f=>f.name!==fragment.name))check(!output.includes(other.detail),'实际详情隔离 '+other.name);
  const candidates=[...output.matchAll(/<candidate_fragment slot="\d" name="([^"]+)">\n([\s\S]*?)\n<\/candidate_fragment>/g)];
  check(candidates.length===3&&candidates.every(m=>fragments.find(f=>f.name===m[1])?.brief===m[2]),'实际候选简述完全对应');
}
check(fragments.filter(f=>f.detail.includes('【可能人物】')).length===2,'只有两处可能活人场景');
for(const phrase of ['玩家并不直接知道殒落大陆的历史真相，需要探索与考古','player_knowledge="not_granted"','魔族非邪恶种族，与天魔无关','不填写袭击的具体年份','不保存固定三选一节点或路线状态'])check(source.includes(phrase),'叙述约束 '+phrase);
const yaml=readFileSync('本格修仙.yaml','utf8');
const block=yaml.split('名称: "[mvu_plot]地域-灵界-殒落大陆"')[1]?.split('\n  - 名称:')[0];
check(block?.includes('启用: true')&&block.includes('类型: 蓝灯')&&block.includes('文件: '+path.replace(/\//g,'\\').replace(/\.txt$/,'')),'现有角色卡入口关联框架');
console.log(`通过 ${checks} 项检查：24正式碎片、精确匹配、三个随机候选、真实详情隔离、地域门禁、考古知识边界及卡配置引用。`);
