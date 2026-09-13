import {emit,normalize,patchFile} from './overview_star_style.mjs';
// 从确认蓝图提取资料；命令行仅输出 apply_patch 补丁，文件编辑由 apply_patch 完成。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

export const targetPath = '世界书/灵界/万兽大陆/[mvu_plot]万兽大陆总览.txt';
export const blueprintPath = '世界书/灵界/万兽大陆/万兽大陆蓝图.md';
const source = readFileSync(blueprintPath, 'utf8').replace(/\r\n/g, '\n');
function section(title) {
  const marker = '## ' + title + '\n';
  assert(source.includes(marker), title);
  return source.split(marker)[1].split('\n## ')[0].trim();
}
function blocks(s, level) {
  const hits = [...s.matchAll(new RegExp('^' + '#'.repeat(level) + ' (.+)$', 'gm'))];
  return hits.map((m, i) => ({title:m[1], body:s.slice(m.index + m[0].length, hits[i+1]?.index ?? s.length).split(/^### /m)[0].trim()}));
}
const fields = s => Object.fromEntries(s.split('\n').filter(l => /^- [^：]+：/.test(l)).map(l => {
  const i = l.indexOf('：'); return [l.slice(2,i), l.slice(i+1)];
}));
const nameOf = title => title.replace(/^\d+[. ]\s*/, '').split(/（|——/)[0];
const people = blocks(section('十、人物设计'),4).map(b => {
  const f=fields(b.body), id=f['身份'].split('；');
  assert.equal(id.length,4,b.title);
  return {name:b.title, gender:id[0].split('，')[0], appearance:id[0].split('，')[1],race:id[1],realm:id[2],role:id[3],fields:Object.fromEntries(Object.entries(f).filter(([k])=>k!=='身份'))};
});
const secretSection=section('十二、秘境设计');
const indexRows=secretSection.split('\n').filter(l=>/^\| \d{2} \|/.test(l)).map(l=>l.split('|').slice(1,-1).map(x=>x.trim()));
const secrets=blocks(secretSection,4).map((b,i)=>{
  const steps=b.body.split('\n').filter(l=>/^\| [1-4] \|/.test(l));
  assert.equal(steps.length,4,b.title);
  const f=fields(b.body);
  return {name:nameOf(b.title),important:b.title.includes('重要秘境'),realm:indexRows[i][3],theme:indexRows[i][4],fields:f,steps,detail:b.body};
});
const ecology=blocks(section('四、生态设定与区域灵感'),3).map((b,i)=>{
  const f=fields(b.body.split('区域灵感：')[0]);
  const resource=f['普通资源'];
  const m=resource.match(/^动物(?:为|有)(.+?)；植物(?:有)?(.+?)；矿产(?:有)?(.+?)(?:。|$)/);
  assert(m,'资源解析 '+b.title);
  const resources=Object.fromEntries(['动物','植物','矿产'].map((k,j)=>[k,m[j+1].replace(/等未开智种群$/, '').split('、')]));
  delete f['普通资源'];
  return {name:nameOf(b.title),title:b.title.replace(/^\d+\. /,''),fields:f,resources,secrets:secrets.slice(i*3,i*3+3).map(s=>s.name),roster:[people[35+i].name]};
});
const work=[
  ['学习山路、辨材与普通测量，随队完成安全区域巡查。','参与本境界的护体、修堤与救援练习，记录工程损耗。','按任职带巡山队、核对山口与堤务，协调属地需求。','教授高阶传承、审核护山与跨域工程，重大征调由山盟合议。'],
  ['认识风候与昼夜班次，练习地面绳索、记录和器具养护。','参与适合自身能力的巡航、制符与风图实测。','按任职管理巡院与驿站，安排昼夜轮班和搜救。','复核危险空域、教授传承并协调跨大陆航务。'],
  ['学习访客接待、祖谱整理与基础识幻，核验适合的师承。','练习神识、身法与护心，随师查访可核实的族史。','按任职主持校谱、客院或山路事务，不以亲疏改证据。','教授高阶幻术与护心，审查祖忆研究及族庭重大争议。'],
  ['辨认药材、记录适食差异，做无需高阶施法的照护与种苗工作。','在监督下参加本境界诊疗与培育，疑难病案交师长。','按任职管理药圃或巡诊队，复核跨族药性与诊疗记录。','会诊复杂神魂与蜕变损伤，教授医药并审核研究风险。'],
  ['练习量尺、辨丝、补衣和安全操作，理解工稿署名。','参与本境界炼器、染织和丝阵，记录材料与结构试验。','按任职带工坊、审图与维护桥索，协调订单和署名。','审核大型织阵、教授高阶炼器，统筹传承与世俗供给。'],
  ['学习测量、通风、仓储与器具维护，按实际能力参加共同事务。','参与本境界营造、育苗、阵法和器具检修。','按任职管理工院、勘验地基、交接轮值并安排学徒。','复核大型营造和公共供养，教授技艺并处理跨域工程。'],
  ['学习分候、辨材与清洗，区分不同族群的环境要求。','参加本境界药理、养身、甲器及护商救治练习。','按任职维护洞候、管理药材与毒伤队，查明事故来源。','审核高风险材料与疗法，教授传承并协调护路和停采。'],
  ['认识水况、族群差异与安全通路，随师抄图、辨材。','练习本境界水法、珠器与巡流，不把化龙作为唯一目标。','按任职调度支汊、复核水图与护航，协调居民用水。','教授高阶水法、审查河网工程，重大水务与府及城盟合议。'],
  ['学习干湿接待、内海航标、器具与维生条件，辨别内海和虚海。','参与本境界潮候、装配、护航练习，跨大陆须有相应保障。','按任职管理礁工、临虚庭署或航务，核对多族生活需求。','教授高阶传承、复核深水和虚海方案，重大事务由诸潮合议。'],
];
const sects=blocks(section('五、修行势力'),3).map((b,i)=>({name:nameOf(b.title),title:b.title.replace(/^\d+\. /,''),type:b.title.includes('大型')?'大':'中',fields:fields(b.body),roster:people.slice(i*3,i*3+3).map(p=>p.name),internal:work[i]}));
const countries=blocks(section('六、凡国与世俗政权'),3).map((b,i)=>({name:nameOf(b.title),title:b.title.replace(/^\d+\. /,''),fields:fields(b.body),roster:[people[27+i].name]}));
const cities=section('七、城市与日常空间').split('\n').filter(l=>/^\| [^ -]/.test(l)).slice(1).map(l=>{
  const c=l.split('|').slice(1,-1).map(s=>s.trim());
  const e=ecology.find(e=>e.fields['地标'].includes(c[0])); assert(e,c[0]);
  return {name:c[0],country:c[1],structure:c[2],life:c[3],ecology:e.name,roster:[...e.roster,...countries.filter(k=>c[1].startsWith(k.name)).flatMap(k=>k.roster)]};
});
const relations=section('十一、人物关系骨架').split('\n').filter(l=>/^\d+\. /.test(l)).map(l=>{
  const label=l.split('：')[0]; return {text:l,names:people.filter(p=>label.includes(p.name)).map(p=>p.name)};
});
const space=section('三、空间结构与往来');
const map=space.match(/```mermaid[\s\S]*?```/)[0];
const geography=blocks(space,3).filter(b=>/水系|交通与经济/.test(b.title)).map(b=>'### '+b.title.replace(/^\d+\. /,'')+'\n'+b.body).join('\n\n');
export const data={ecology,sects,countries,cities,people,secrets,relations,map,geography,
  core:'- 定位: '+blocks(section('二、大陆核心设定'),3)[0].body+'\n- 社会: 妖族主导，族庭、跨族宗门与低阶城国并存；无统一妖皇。\n- 修为: 化神为中坚，返虚常任管事长老，合体多为宗主，大乘公开仅两位；凡国人物最高金丹，依赖宗门庇护。\n- 规则: 开智、化形与境界分别判断；物种不是性格和职业的唯一决定因素；沿用现有灵石、五行、物品与功法体系。\n- 天魔: 仅为历史与远期威胁，不设未来入侵年份或倒计时。',
  history:blocks(section('二、大陆核心设定'),3).slice(1).map(b=>'### '+b.title.replace(/^\d+\. /,'')+'\n'+b.body).join('\n\n'),
  politics:section('八、共同政治与跨族生活规则').replace('见第十节的','').replace('见第十节各人物','以具体人物档案为准'),
};
assert.equal(people.length,45); assert.equal(sects.length,9); assert.equal(countries.length,8);
assert.equal(cities.length,9); assert.equal(ecology.length,8); assert.equal(secrets.length,24); assert.equal(relations.length,23);
assert.equal(people.filter(p=>p.gender==='女').length,36);
for(const k of countries) assert(people.find(p=>p.name===k.roster[0]).realm.startsWith('金丹'));
for(const r of relations) assert(r.names.length>=2,r.text);

export function build(){ return emit(normalize('万兽大陆',data)); }
if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv.includes('--check')){
    assert.equal(readFileSync(targetPath,'utf8').replace(/\r\n/g,'\n'),build(),'总览与蓝图不同步');
    console.log('万兽大陆总览与蓝图一致。');
  }else process.stdout.write('*** Begin Patch\n'+patchFile(targetPath,build())+'*** End Patch\n');
}
