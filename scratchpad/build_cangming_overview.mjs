import {emit,normalize,patchFile} from './overview_star_style.mjs';
// 蓝图是唯一资料源；构建器只输出补丁，实际文件编辑交由 apply_patch。
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

export const targetPath='世界书/灵界/沧溟大陆/[mvu_plot]沧溟大陆总览.txt';
export const blueprintPath='世界书/灵界/沧溟大陆/沧溟大陆蓝图.md';
const source=readFileSync(blueprintPath,'utf8').replace(/\r\n/g,'\n');
function section(prefix){
  const match=[...source.matchAll(/^## (.+)$/gm)].find(m=>m[1].startsWith(prefix));
  assert(match,prefix);
  return source.slice(match.index+match[0].length).split(/^## /m)[0].trim();
}
function blocks(s,level){
  const hits=[...s.matchAll(new RegExp('^#{'+level+'} (.+)$','gm'))];
  return hits.map((m,i)=>({title:m[1],body:s.slice(m.index+m[0].length,hits[i+1]?.index??s.length).split(new RegExp('^#{1,'+(level-1)+'} ','m'))[0].trim()}));
}
const fields=s=>Object.fromEntries(s.split('\n').filter(l=>/^- [^：]+：/.test(l)).map(l=>{const i=l.indexOf('：');return [l.slice(2,i),l.slice(i+1)];}));
const nameOf=s=>s.replace(/^\d+\. /,'').split(/——|（/)[0].trim();
const metadata=(body,key)=>body.match(new RegExp(key+'：([^；。\\n]+)'))?.[1];
const people=blocks(section('九、'),4).map(b=>({name:b.title,gender:metadata(b.body,'性别'),appearance:metadata(b.body,'外观分类'),age:metadata(b.body,'实际年龄'),race:metadata(b.body,'种族'),realm:metadata(b.body,'境界'),system:metadata(b.body,'体系'),role:metadata(b.body,'身份'),fields:fields(b.body)}));
const secrets=blocks(section('十一、'),3).flatMap(region=>blocks(region.body,4).map(b=>{
  const f=fields(b.body), steps=b.body.split('\n').filter(l=>/^- 阶段[1-4]：/.test(l));
  assert.equal(steps.length,4,b.title);
  return {name:b.title,ecology:region.title.replace(/^\d+\. /,'').replace(/秘境$/,''),realm:f['推荐境界'],important:f['推荐境界'].includes('重要秘境'),fields:Object.fromEntries(Object.entries(f).filter(([k])=>!/^阶段/.test(k))),steps,detail:b.body};
}));
const ecology=blocks(section('四、'),3).map(b=>{
  const f=fields(b.body.split('区域灵感：')[0]),name=nameOf(b.title);
  const resources=f['普通资源'];delete f['普通资源'];
  return {name,title:b.title.replace(/^\d+\. /,''),fields:f,resources,stories:b.body.split('\n').filter(l=>/^\d+\. /.test(l)),roster:people.filter(p=>p.fields['所属'].startsWith(name+'；')).map(p=>p.name),secrets:secrets.filter(s=>s.ecology===name).map(s=>s.name)};
});
const work=[
  ['学习多族医养、礁体测量与安全接待。','在监督下练习声律、医术、护礁及本境界阵法。','按实际任职复核工程和病例，指导教习并保留异议。','传授高阶功法、审议护城风险；不得以修为代替城盟议决。'],
  ['学习航标、基本测流、绳具与救援常识。','参与本境界护航、校图、潜舟维修与救援演练。','按任职复核航图，调度巡路与救援队并公开基本安全信息。','教授高阶水法和航行，协调大航道风险，不将自然通路据为私产。'],
  ['辨材、量尺、记载炉况，学习隔水工室安全。','在师长监督下炼器、检修与勘测，不擅改排水。','按任职审核炉具、风险与迁建方案，指导工坊。','处理高阶营造与传承，尊重人格和世俗矿契，不越权夺矿。'],
  ['学习耐水档案、授权、低光生活和压力适应。','练习本境界神识、护体与档案修复，不窥读私人记忆。','按任职主持护压或层卷工作，核对授权与证据。','传授高阶感知与阵法，协商深浅海公共保障，不因秘藏而独断城政。'],
  ['学习辨藻、织养、轮圃与合法采集。','参与适合境界的培育、医养与病害调查。','按任职审核试种风险、带教并记录损失责任。','传授高阶水木功法、统筹护国与重大生态事务，不强迫居民改种。'],
  ['学习冰况、护寒、通息井与暖驿安全。','参与本境界寒路巡护、医养与护寒器具维护。','按任职协调井群轮值、冰况复核与寒路救援。','传授寒水与护体高阶功法，协商援助，不以应急为名永久征谷。'],
  ['学习无损观察、样本标签、培育基础和知情许可。','参与本境界育苗、诊疗、修复与地层记录。','按任职审查试验、带队复核并协调居民使用权。','传授高阶技艺、评估生态风险；不将研究目的置于人格与同意之上。'],
  ['学习温盐记录、校器和外围撤离规则。','参与本境界巡标、取样与观测，核心另需批准。','按任职交叉复核数据、划定安全线并指导新队伍。','主持高阶观测与传承，明确未知；不得宣称凭职位掌控生海之庭。'],
  ['学习水港与虚空区别、多体型接待及换乘安全。','参与本境界升潮检修、飞舟维护和护航练习。','按任职复核接舷、港防与设备风险，安排救援。','传授高阶航行和阵法，协调水空接驳，不出售公共通行权。'],
];
const sects=blocks(section('五、'),3).map((b,i)=>{
  const name=nameOf(b.title);return {name,title:b.title.replace(/^\d+\. /,''),large:b.title.includes('大型'),fields:fields(b.body),roster:people.filter(p=>p.system==='宗门'&&p.fields['所属'].includes('；'+name)).map(p=>p.name),internal:work[i]};
});
const countries=blocks(section('六、'),3).map(b=>{
  const name=nameOf(b.title);return {name,title:b.title.replace(/^\d+\. /,''),fields:fields(b.body),roster:people.filter(p=>p.system==='世俗'&&p.fields['所属'].includes('；'+name)).map(p=>p.name)};
});
const rows=section('三、').split('\n').filter(l=>/^\| /.test(l)).slice(2).map(l=>l.split('|').slice(1,-1).map(x=>x.trim()));
const cities=rows.map(r=>{
  const e=ecology.find(e=>e.name===r[0]);assert(e,r[0]);
  const name=r[2].replace(/（.*$/,'');
  const country=countries.find(c=>r[3].startsWith(c.name));assert(country,r[3]);
  const structure=e.fields['居民与聚落'];
  assert(structure,name);
  return {name,ecology:e.name,country:country.name,structure,life:e.fields['风俗与生活'],transport:e.fields['生产与交通'],landmarks:e.fields['地标'].split(/[、。]/).filter(Boolean),roster:e.roster};
});
// 九区各一个具名聚落；双阙港的内水阙与外空阙是港区，不另算城市。
const relations=section('十、').split('\n').filter(l=>l.startsWith('- ')).map(text=>({text,names:people.filter(p=>text.split('：')[0].includes(p.name)).map(p=>p.name)}));
for(const r of relations)assert(r.names.length>=2,r.text);
const map=section('三、').match(/```mermaid[\s\S]*?```/)[0];
const space=section('三、').split('```').at(-1).trim();
export const data={people,secrets,ecology,sects,countries,cities,relations,map,space,
  constraints:section('一、').split('\n').filter(l=>l.startsWith('- ')&&!/第三步|后续人物/.test(l)).join('\n'),
  history:section('二、'),politics:section('七、'),exploration:section('十一、').split(/^### 1\./m)[0].replace(/^### 通用探索规则\n/,'').replace(/本蓝图/g,'本地设定'),
  core:'沧溟大陆是承海岩盆上的水下文明，外围虚海为无底深空。鱼人与其他海洋妖族为主体，鱼人属于妖族、典型为人形上身鱼尾下身；无原生人类，人类仅有外大陆来访修士。浅海与深海都有繁华城市，多族海国并存。生海之庭持续生水，火山塑造海床，外缘落海瀑布参与平衡；生命起源仍有未知，不授予造海、复活或必定突破能力。凡国人物不高于金丹，依赖宗门庇护；不设下一次天魔入侵的日期。',
};
assert.equal(people.length,63);assert.equal(ecology.length,9);assert.equal(secrets.length,27);assert.equal(sects.length,9);assert.equal(countries.length,8);assert.equal(cities.length,9);
for(const e of ecology){assert.equal(e.roster.length,7);assert.equal(e.secrets.length,3);assert.equal(e.stories.length,6);}
for(const s of sects)assert.equal(s.roster.length,3);

export function build(){ return emit(normalize('沧溟大陆',data)); }
if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv.includes('--check')){
    assert.equal(readFileSync(targetPath,'utf8').replace(/\r\n/g,'\n'),build(),'总览与蓝图不同步');
    console.log('沧溟大陆总览与蓝图一致。');
  }else process.stdout.write('*** Begin Patch\n'+patchFile(targetPath,build())+'*** End Patch\n');
}
