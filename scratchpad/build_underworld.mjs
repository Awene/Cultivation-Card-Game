// 从已确认蓝图生成补丁；不直接写文件。
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const blueprintPath = '世界书/冥界/冥界蓝图.md';
export const overviewPath = '世界书/冥界/[mvu_plot]冥界总览.txt';
export const blueprint = fs.readFileSync(blueprintPath, 'utf8').replace(/\r\n/g, '\n');
const q = JSON.stringify;
const arr = a => '[' + a.map(q).join(', ') + ']';
const tpl = s => '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
const field = (body, key) => {
  const line = body.split('\n').find(l => l.startsWith('- ' + key + '：'));
  assert(line, '缺少字段 ' + key);
  return line.slice(key.length + 3);
};
function sections(prefix, depth = 3) {
  const re = new RegExp('^' + '#'.repeat(depth) + ' (' + prefix + '\\d+)·([^\\n]+)\\n([\\s\\S]*?)(?=^#{1,' + depth + '} |$(?![\\s\\S]))', 'gm');
  return [...blueprint.matchAll(re)].map(m => ({id:m[1], name:m[2], body:m[3].trim()}));
}
export const ecologies = sections('E');
export const sects = sections('S');
export const governments = sections('K');
export const secrets = sections('M').map(m => ({...m,
  eco: field(m.body,'生态与位置').split('，')[0],
  stages: m.body.split('\n').filter(l => /^\| [1-4] \|/.test(l)).map(l => l.split('|').slice(1,-1).map(x=>x.trim())),
}));
const groups = ['玄津宫','澄川宗','续灯观','百骸山','归尘台','苔庭院','阴都与驿野','苇汀联埠','百坊与青苔','归灯集与独立人物'];
const groupEnds = [6,9,12,15,18,21,27,31,36,40];
const ecoByGroup = ['阴都盆地','忘川两岸','南岸诸境','南岸诸境','远冥边地','南岸诸境','阴都盆地','忘川两岸','南岸诸境','远冥边地'];
export const people = sections('C',4).map((p,i) => {
  const identity=field(p.body,'身份').split('；');
  const groupIndex=groupEnds.findIndex(end=>i<end);
  const visual=field(p.body,'外貌与衣饰');
  const artifactAt=visual.search(/(?:常用法宝为|法宝为|用物为|常用小钳)/);
  assert(artifactAt>=0,p.name+'法宝');
  const rawLook=visual.slice(0,artifactAt).replace(/[；，。]+$/,'');
  const clothes=[],looks=[];
  for(const part of rawLook.split(/[，；]/)) (/衣|袍|衫|裙|褂|袖|署服|旅披|旅氅|披肩|披帛|围裙|腰封|护目布|靴底|苇笠/.test(part)?clothes:looks).push(part);
  assert(clothes.length,p.name+'衣饰');
  const artifact=visual.slice(artifactAt).replace(/^(?:常用法宝为|法宝为|用物为|常用)/,'').replace(/。$/,'');
  const role=identity.slice(5).join('；');
  const age=Number(identity[4].match(/年龄(\d+)岁/)[1]);
  let eco=ecoByGroup[groupIndex];
  if([6,26,27].includes(i+1))eco='黄泉驿野';
  if(i+1===5)eco='忘川两岸';
  const group=groups[groupIndex];
  return {...p, gender:identity[0], appearanceType:identity[1], race:identity[2], realm:identity[3], age,
    title:role.split(/[，。]/)[0], role, group, eco,
    look:looks.join('，'), clothes:clothes.join('，'), artifact,
    personality:field(p.body,'性情与生活'), story:field(p.body,'职责与故事'),
    file:`世界书/冥界/人物/[mvu_plot]人物-冥界-${group}.txt`,
  };
});
assert.equal(people.length,40); assert.equal(ecologies.length,5); assert.equal(secrets.length,15);
assert(secrets.every(m=>m.stages.length===4));

// 将蓝图中的工作按权限分为随行学习、独立实务、统筹、宗务决策。
const innerWork = {
  玄津宫:['随接引队核认路牌、整理驿舍，听教习讲解轮回沿线与留居招收。','独立承担接引交接、案卷核录或灵炉检修，遇到跨宗疑案交判官司会勘。','安排接引班次、复核罪魂交接，协调停炉检修与沿线供灵。','主持跨院议事，在轮回便利、招收弟子与炼魂供给之间定夺，参与《津岸约》协商。'],
  澄川宗:['随船认航标、练绳结，在堤上学习测水和护舟阵的基础。','承担分段测水、护航和船坞维修，和船户一起核对潮况。','统筹河段巡渡、修堤人手与用水资料，同联埠议定工程次序。','主持分水和宗门护航安排，与玄津宫商议桥渡，与上下游共同确定大段治水方案。'],
  续灯观:['整理药袋、照料药苗，随医师巡诊并记录不同形态的用具。','独立接诊常见损伤，参与修形协作和药圃病害排查。','安排医师巡诊、疗养床位与药材供应，协调百坊城和青苔镇的医疗需求。','主持医理讨论和药谷庇护，决定泉脉治理及与其他宗门的合作。'],
  百骸山:['分拣炉料、维护工具，随师傅学习听火、打模和修形器的用途。','独立承接器具、船械与修形订单，和医师或船匠核对使用效果。','统筹炉期、矿务与交付，协调作坊用工及矿水勘查。','主持传承与大型订单，处理公共工艺、城盟自治和跨宗供货的分歧。'],
  归尘台:['整理寄灯和联络资料，学习渡器保养，随行旅队维护驿路。','承担寻身联络、契约核验和阵房实务，将存疑货源交回堂内核查。','安排渡台检修、联络次序与求渡者接待，协调归灯集补给。','决定渡台开放与阳间合作，主持跨宗求渡协商和重要阵路修复。'],
  苔庭院:['照料苗床、清理水沟，随教习巡田，学习分辨药苗与菌种。','承担试种、病害取样和分水测量，向村户传授培育方法。','统筹试田、苗种保存与分水，和乡约、医观共同处理泉脉问题。','主持地脉培育与乡约庇护，议定推广规模、用地和跨宗水源协商。'],
};
const inner = name => Object.fromEntries(['外门','内门','管事','长老'].map((tier,i)=>[tier,
  `### ${name}·${tier}视角\n- 门内日常: ${innerWork[name][i]}`]));

export function overview() {
  let out=String.raw`<%_ { _%>
<%_
// 冥界总览：非冥界隐藏；冥界内显示全域，城市按关键词、秘境按具体地点展开。
const world = getMessageVar('stat_data.地点.世界') || '凡界';
const region = getMessageVar('stat_data.地点.地域') || '';
const 具体地点 = getMessageVar('stat_data.地点.具体地点') || '';
let outputText = '';
if (world === '冥界') {
  const recentText = (getChatMessages(-10) || []).join('\n');
  const scanText = 具体地点 + '\n' + recentText;
  const mentioned = kws => kws.some(kw => scanText.includes(kw));
  const appeared = getMessageVar('stat_data.关系列表') || {};
  const roster = names => names.map(name => {
    const c = characters[name];
    const known = Object.prototype.hasOwnProperty.call(appeared, name);
    return '  - ' + c.title + ': ' + (known ? '' : c.realm + ' ') + name + '(' + c.appearanceType + ')' +
      (known ? '' : '\n' + c.moderate.map(line => '    ' + line).join('\n'));
  }).join('\n');
  const 身份原值 = getMessageVar('stat_data.身份') || [];
  const 身份列表 = Array.isArray(身份原值) ? 身份原值 : [身份原值];
  const 境界 = String(getMessageVar('stat_data.修炼进度.境界') || '凡人').replace('练气','炼气').replace('炼虚','返虚');
  const L = ['凡人','炼气','筑基','金丹','元婴','化神','返虚','合体','大乘','渡劫'].findIndex(n => 境界.includes(n));
  const 门内档 = L <= 4 ? '外门' : L === 5 ? '内门' : L === 6 ? '管事' : '长老';
  const 本宗弟子 = kws => 身份列表.some(id => kws.some(kw => id.includes(kw)));
  const pick3 = pool => {
    const copy = [...pool];
    for (let i=copy.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; }
    return copy.slice(0,3).join('、');
  };

  // ========== 人物 ==========
  const characters = {
`;
  for(const p of people)out+=`    ${q(p.name)}: {\n      title: ${q(p.title)}, realm: ${q(p.realm)}, appearanceType: ${q(p.appearanceType)},\n      moderate: ${arr(['外貌: '+p.race+'；'+p.look,'着装: '+p.clothes,'法宝: '+p.artifact])},\n    },\n`;
  out+='  };\n\n  // ========== 秘境 ==========\n  const M = {\n';
  for(const m of secrets){
    const brief=`- ${m.name} [${field(m.body,'推荐境界').split('；')[0]}]: ${field(m.body,'结构与用途')}`;
    const detail=`### ${m.name}\n`+m.body.split('\n').filter(l=>l.startsWith('- ')).join('\n')+'\n'+m.stages.map(([n,scene,danger,solution,reward])=>`  ${n}. ${scene}\n    险: ${danger}\n    解: ${solution}\n    获: ${reward}`).join('\n');
    out+=`    ${q(m.name)}: {\n      brief: ${tpl(brief)},\n      detail: ${tpl(detail)},\n    },\n`;
  }
  out+='  };\n  const 秘境显示 = names => names.map(n => 具体地点.includes(n) ? M[n].detail : M[n].brief).join("\\n");\n\n  // ========== 普通资源 ==========\n  const RES = {\n';
  for(const e of ecologies)out+=`    ${q(e.name)}: ${arr(field(e.body,'普通资源').split('。')[0].split('、'))},\n`;
  out+='  };\n\n  // ========== 生态 ==========\n  const ecoData = {\n';
  for(const e of ecologies){
    const text=e.body.split('\n').filter(l=>l.startsWith('- ')&&!l.startsWith('- 普通资源')).join('\n');
    const ms=secrets.filter(m=>m.eco===e.name).map(m=>m.name);
    const residents=people.filter(p=>p.eco===e.name).map(p=>p.name);
    out+=`    ${q(e.name)}: {\n      header: ${q(e.name+'：'+field(e.body,'方位'))},\n      mizing: ${arr(ms)},\n      detail: () => ${tpl('### '+e.name+'\n'+text).slice(0,-1)}\n- 普通资源: \${pick3(RES[${q(e.name)}])}\n- 人物:\n\${roster(${arr(residents)})}\n\${秘境显示(${arr(ms)})}\x60,\n    },\n`;
  }
  out+='  };\n\n  // ========== 宗门 ==========\n  const sectsData = {\n';
  for(const s of sects){
    const size=s.id==='S01'||s.id==='S02'||s.id==='S04'?'大':s.id==='S06'?'小':'中';
    out+=`    ${q(s.name)}: {\n      type: ${q(size)},\n      brief: ${tpl('### '+s.name+'\n'+field(s.body,'简介与理念'))},\n      detail: ${tpl('### '+s.name+'\n'+s.body)},\n      门内kws: ${arr([s.name])},\n      门内: {\n`;
    for(const[t,v]of Object.entries(inner(s.name)))out+=`        ${q(t)}: ${tpl(v)},\n`;
    out+='      },\n    },\n';
  }
  out+='  };\n\n  // ========== 世俗政权与城市 ==========\n  const kingsData = {\n';
  const keys=[['阴都','枉死城','歇灯镇','百灯街','听坊厅','候乡台'],['苇汀城','九汊堤','千桩船坞'],['百坊城','旧铜坊','百工堂'],['青苔镇','分芽厅','留水塘'],['归灯集','寄灯公堂','沉灯旧城']];
  const charsByKing=[[22,23,24,25,26,27],[28,29,30,31],[32,33,34],[35,36],[37,38,39,40]];
  governments.forEach((k,i)=>{
    out+=`    ${q(k.name)}: {\n      kws: ${arr([k.name,...keys[i],...charsByKing[i].map(n=>people[n-1].name)])},\n      brief: ${tpl('### '+k.name+'\n'+field(k.body,'简介、疆域与政体'))},\n      detail: ${tpl('### '+k.name+'\n'+k.body)},\n    },\n`;
  });
  out+='  };\n\n  // ========== 地图 ==========\n';
  const map=blueprint.match(/```mermaid\n([\s\S]*?)```/)[1];
  const geography=blueprint.split('忘川西高东低，')[1].split('```')[0].trim();
  out+=`  const mapText = ${tpl('<region_map realm="冥界">\n```mermaid\n'+map+'```\n忘川西高东低，'+geography+'\n交通：驿车、渡船与商队连接聚落；寄身渡联系特定阳间肉体。\n</region_map>')};\n`;
  const accord=blueprint.split('### 3. 《津岸约》与权力尺度\n')[1].split('### 4.')[0].trim();
  const crossing=blueprint.split('### 4. 寄身渡\n')[1].split('## 二、')[0].trim();
  out+=`  const societyText = ${tpl('## 津岸秩序\n'+accord+'\n## 寄身渡\n'+crossing)};\n`;
  out+=String.raw`
  // ========== 装配输出 ==========
  const geoOut = Object.values(ecoData).map(e => e.detail()).join('\n\n');
  const sectsOut = Object.values(sectsData).map(s => s.detail +
    (本宗弟子(s.门内kws) ? '\n\n' + s.门内[门内档] : '')).join('\n\n');
  const kingsOut = Object.values(kingsData).map(k => mentioned(k.kws) ? k.detail : k.brief).join('\n\n');
  outputText = '<region_information realm="冥界">\n地点层级: 冥界-生态-宗门/秘境/城市(可选)-具体位置\n' +
    '地域沿用当前地点记录，生态写入具体地点；鬼域荒野为忘川南岸留居地域的旧称。\n' +
    '## 冥界概述\n永夜中的亡者社会：轮回沿线之外，田庄、渡镇、工坊与城邦各有生活。\n' +
    societyText + '\n\n## 冥界生态\n' + geoOut + '\n\n## 冥界宗门\n' + sectsOut +
    '\n\n## 冥界世俗政权与城市\n' + kingsOut + '\n</region_information>\n' + mapText;
}
_%>
<%- outputText %>
<%_ } _%>
`;
  return out.replaceAll('\\\\n','\\n');
}

export function characterFiles(){
  return new Map(groups.map(group=>{
    const ps=people.filter(p=>p.group===group);
    let source=String.raw`<%_ { _%>
<%_
const 人物关系 = getMessageVar('stat_data.关系列表') || {};
const recentText = (getChatMessages(-10) || []).join('\n');
const C = {
`;
    for(const p of ps){
      const short=`### ${p.name} (${p.appearanceType})\n身份: ${p.title}\n外貌: ${p.race}；${p.look}\n着装: ${p.clothes}\n法宝: ${p.artifact}`;
      const detail=`### ${p.name} (${p.appearanceType})\n着装: ${p.clothes}\n法宝: ${p.artifact}\n性情与生活: ${p.personality}\n职责与故事: ${p.story}`;
      source+=`  ${q(p.name)}: {\n    kws: ${arr([p.name])},\n    locationKws: [],\n    moderate: ${tpl(short)},\n    detail: ${tpl(detail)},\n  },\n`;
    }
    source+=String.raw`};
const outputText = Object.entries(C).map(([name,c]) =>
  Object.prototype.hasOwnProperty.call(人物关系,name) ? c.detail :
  c.kws.some(kw => recentText.includes(kw)) ? c.moderate : '').filter(Boolean).join('\n\n');
_%>
<%- outputText %>
<%_ } _%>
`;
    return [ps[0].file,source.replaceAll('\\\\n','\\n')];
  }));
}

function registerYaml(before){
  const overviewEntry=`  - 名称: "[mvu_plot]地域-冥界"\n    启用: true\n    激活策略:\n      类型: 蓝灯\n    插入位置:\n      类型: 角色定义之前\n      顺序: 52\n    激活概率: 100\n    递归:\n      不可被其他条目激活: false\n      不可激活其他条目: true\n    文件: 世界书\\冥界\\[mvu_plot]冥界总览\n\n`;
  let s=before;
  if(!s.includes('文件: 世界书\\冥界\\[mvu_plot]冥界总览'))s=s.replace('  - 名称: ➤世界信息-end',overviewEntry+'  - 名称: ➤世界信息-end');
  let entries='';
  for(const group of groups){
    const ps=people.filter(p=>p.group===group), name=`[mvu_plot]人物-冥界-${group}`;
    if(s.includes(`名称: "${name}"`))continue;
    const kws=[...new Set([...ps.map(p=>p.name),...ps.map(p=>p.eco),group])];
    entries+=`  - 名称: "${name}"\n    启用: true\n    激活策略:\n      类型: 绿灯\n      关键字:\n${kws.map(k=>'        - '+q(k)).join('\n')}\n    插入位置:\n      类型: 角色定义之前\n      顺序: 200\n    激活概率: 100\n    特殊效果:\n      黏性: 5\n    递归:\n      不可被其他条目激活: false\n      不可激活其他条目: true\n    文件: ${ps[0].file.slice(0,-4).replaceAll('/','\\')}\n\n`;
  }
  return s.replace('  - 名称: ➤人物信息-end',entries+'  - 名称: ➤人物信息-end');
}
const csvCell=v=>/[",\r\n]/.test(String(v))?'"'+String(v).replaceAll('"','""')+'"':String(v);
const csvLine=a=>a.map(csvCell).join(',');
export function artifacts(){
  const files=new Map([[overviewPath,overview()],...characterFiles()]);
  files.set('本格修仙.yaml',registerYaml(fs.readFileSync('本格修仙.yaml','utf8').replace(/\r\n/g,'\n')));
  const charPath='Doc/角色蓝图.csv';
  const charCsv=fs.readFileSync(charPath,'utf8').replace(/\r\n/g,'\n');
  const newPeople=people.filter(p=>!charCsv.split('\n').some(l=>l.startsWith(p.name+',')));
  files.set(charPath,charCsv.trimEnd()+'\n'+newPeople.map(p=>csvLine([
    p.name,p.gender,[p.name,p.group,p.eco].join('、'),'冥界-'+p.eco,p.appearanceType,'',p.look,p.clothes,'',p.personality,p.artifact,
    '冥界',p.eco,p.race,p.realm,p.age,p.group,p.role,p.file,'',p.personality,'',p.story,p.story,p.personality,'','','','','','',
  ])).join('\n')+(newPeople.length?'\n':''));
  const secretPath='Doc/秘境清单.csv';
  const secretCsv=fs.readFileSync(secretPath,'utf8').replace(/\r\n/g,'\n');
  const newSecrets=secrets.filter(m=>!secretCsv.includes(','+m.name+','));
  files.set(secretPath,secretCsv.trimEnd()+'\n'+newSecrets.map(m=>{
    const range=field(m.body,'推荐境界').split('；')[0],high=range.split('至').at(-1);
    const important=['M05','M07','M15'].includes(m.id);
    return csvLine(['冥界',m.eco,m.name,m.stages.map(st=>st[1]+'['+range+']').join(' / '),high,field(m.body,'入口与开放'),field(m.body,'结构与用途'),important?'TRUE':'FALSE',important?'已确认远期主线节点':'地方生活与独立探索']);
  }).join('\n')+(newSecrets.length?'\n':''));
  return files;
}
export function patchFor(file,after){
  const exists=fs.existsSync(file),before=exists?fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'):'';
  if(before===after)return '';
  const oldLines=before.trimEnd().split('\n'),newLines=after.trimEnd().split('\n');
  let start=0,end=0;
  if(exists){
    while(start<oldLines.length && start<newLines.length && oldLines[start]===newLines[start])start++;
    start=Math.max(0,start-2);
    while(end<oldLines.length-start && end<newLines.length-start && oldLines.at(-end-1)===newLines.at(-end-1))end++;
    end=Math.max(0,end-2);
  }
  return `*** ${exists?'Update':'Add'} File: ${resolve(file).replaceAll('\\','/')}\n`+
    (exists?'@@\n'+oldLines.slice(start,oldLines.length-end).map(l=>'-'+l).join('\n')+'\n':'')+
    newLines.slice(start,newLines.length-end).map(l=>'+'+l).join('\n')+'\n';
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))
  process.stdout.write('*** Begin Patch\n'+[...artifacts()].map(([f,s])=>patchFor(f,s)).join('')+'*** End Patch\n');
