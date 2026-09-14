import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {compactCharacters} from './spirit_roster_template.mjs';

const regions=['星坠大陆','圣银大陆','灵境大陆','万兽大陆','沧溟大陆','太初大陆','殒落大陆'];
const counts=[42,42,32,45,63,32,2];
let checks=0,people=0;
const check=(v,m)=>{assert(v,m);checks++;};
for(const [index,region] of regions.entries()){
  const path=`世界书/灵界/${region}/[mvu_plot]${region}总览.txt`;
  const src=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');
  const instrumented=src.replace(/  const characters = \{[\s\S]*?\n  \};/,
    m=>m+'\n  globalThis.__roster={characters,renderRosterCharacter};');
  const relationships={};
  const vars={'stat_data.地点.世界':'灵界','stat_data.地点.地域':region,'stat_data.地点.具体地点':'','stat_data.关系列表':relationships};
  let code='let rendered="";\n';
  for(const m of instrumented.matchAll(/<%([_=\-]?)([\s\S]*?)([_\-]?)%>/g))
    code+=['-','='].includes(m[1])?'rendered+=('+m[2]+');\n':m[2]+'\n';
  const program=new vm.Script(code+'\nrendered;');
  const run=()=>{
    const ctx={getMessageVar:k=>vars[k],getChatMessages:()=>[]};
    const output=program.runInNewContext(ctx,{timeout:3000});
    return {...ctx.__roster,output};
  };
  const {characters,renderRosterCharacter}=run();
  check(Object.keys(characters).length===counts[index],region+'人数');
  check(JSON.stringify(characters)===JSON.stringify(compactCharacters(region)),region+'生成数据一致');
  for(const [name,c] of Object.entries(characters)){
    people++;
    check(Object.keys(c).join('/')==='title/realm/appearanceType/moderate',name+'四字段');
    check(c.title&&c.realm&&c.appearanceType,name+'基础信息');
    check(c.moderate.length===3&&c.moderate.every((line,i)=>line.startsWith(['外貌: ','着装: ','法宝: '][i])),name+'三行简介');
    const before=renderRosterCharacter(name);
    check(before.split('\n').length===4&&before.includes(c.realm),name+'未登记四行');
    relationships[name]={};
    const after=renderRosterCharacter(name);
    check(after===`  - ${c.title}: ${name}(${c.appearanceType})`,name+'已登记仅名片');
    delete relationships[name];
  }
  vars['stat_data.地点.世界']='凡界';
  check(run().output==='',region+'世界隔离');
  vars['stat_data.地点.世界']='灵界';
  if(region==='殒落大陆'){
    for(const [name,place] of [['朔灯','遗火小庐'],['绛苇','藏息医舍']]){
      vars['stat_data.地点.具体地点']=region+'-'+place+'-门外';
      check(run().output.includes(characters[name].moderate[0]),name+'驻地实际展开');
      relationships[name]={};
      check(!run().output.includes(characters[name].moderate[0]),name+'实际输出收起简介');
      delete relationships[name];
    }
  }
  const patch=execFileSync(process.execPath,['scratchpad/sync_spirit_rosters.mjs',region],{encoding:'utf8'});
  check(patch.trim()==='*** Begin Patch\n*** End Patch',region+'重复生成无差异');
}
console.log(JSON.stringify({regions:regions.length,people,checks,status:'PASS'},null,2));
