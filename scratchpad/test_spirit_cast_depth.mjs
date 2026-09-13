import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {regions,read,sources} from './spirit_cast_sources.mjs';
const partial=process.argv.includes('--partial');
let count=0,chars=0,checks=0;
const seen=new Map();
const ok=(v,m)=>{assert(v,m);checks++;};
for(const region of regions){
  const path='scratchpad/deep-cast-'+region+'.json';
  const rows=existsSync(path)?JSON.parse(read(path)):[];
  const expected=Object.keys(sources[region].runtime.characters);
  ok(new Set(rows.map(p=>p.name)).size===rows.length,region+' 重名');
  for(const p of rows){
    ok(expected.includes(p.name),region+' 未确认人物 '+p.name);
    for(const key of ['charm','outer','inner','artifact','core','confession'])ok(typeof p[key]==='string'&&p[key].trim(),p.name+' 缺 '+key);
    ok(p.traits?.length===2&&p.traits.every(t=>typeof t.name==='string'&&t.scenes?.length===3),p.name+' 两种性格各三段');
    ok(p.partner?.length===4,p.name+' 四段道侣日常');
    ok(p.traits[0].name!==p.traits[1].name,p.name+' 性格标签不同');
    ok(p.traits.every(t=>!/[A-Za-z]|待定|占位|性格特征[AB甲乙]/.test(t.name)),p.name+' 标签未完成');
    const paragraphs=[p.core,...p.traits.flatMap(t=>t.scenes),p.confession,...p.partner];
    for(const [i,text] of paragraphs.entries()){
      ok(typeof text==='string'&&(text.match(/[\u3400-\u9fff]/g)||[]).length>=80,p.name+' 第 '+i+' 段不足 80 汉字');
      ok(!seen.has(text),p.name+' 与 '+seen.get(text)+' 整段重复');
      ok(!/鲛人|玄黄大陆|TODO|待补写|占位符/.test(text),p.name+' 旧命名或占位');
      seen.set(text,p.name);chars+=text.length;
    }
    count++;
  }
  if(!partial)ok(expected.every(n=>rows.some(p=>p.name===n)),region+' 尚未全员深写');
  console.log(region+': '+rows.length+'/'+expected.length);
}
console.log(JSON.stringify({mode:partial?'阶段性结构检查，非全员完成':'全员结构检查',people:count,paragraphs:seen.size,paragraphCharacters:chars,checks,note:'结构与覆盖检查不能代替人工文风、设定一致性和人物差异审读。'}));
