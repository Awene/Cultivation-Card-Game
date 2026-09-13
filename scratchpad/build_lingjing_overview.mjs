import {emit,normalize,patchFile} from './overview_star_style.mjs';
// 从已确认蓝图机械提取资料，生成自包含 EJS；CLI 只输出 apply_patch 补丁，不写文件。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

export const blueprintPath = '世界书/灵界/灵境大陆/灵境大陆蓝图.md';
export const targetPath = '世界书/灵界/灵境大陆/[mvu_plot]灵境大陆总览.txt';
const text = readFileSync(blueprintPath, 'utf8').replace(/\r\n/g, '\n');
function section(title) {
  const marker = `## ${title}\n`;
  const start = text.indexOf(marker);
  assert(start >= 0, `缺少章节：${title}`);
  const body = text.slice(start + marker.length);
  return body.split('\n## ')[0].trim();
}
function blocks(source, level) {
  const pattern = new RegExp(`^${'#'.repeat(level)} (.+)$`, 'gm');
  const hits = [...source.matchAll(pattern)];
  return hits.map((m, i) => ({
    title: m[1], body: source.slice(m.index + m[0].length, hits[i + 1]?.index ?? source.length).trim(),
  }));
}
function fields(body) {
  return Object.fromEntries(body.split('\n').filter(s => /^- [^：]+：/.test(s))
    .map(s => { const i = s.indexOf('：'); return [s.slice(2, i), s.slice(i + 1)]; }));
}
const cleanName = title => title.replace(/^\d+\. /, '').split('（')[0];
const lines = obj => Object.entries(obj).map(([k, v]) => `- ${k}: ${v}`).join('\n');

const rosterNames = [
  ['花照年','阮青畦','叶绡'], ['石含璋','纪砚微','裴岩生'],
  ['谢晴岚','温霁','许知禾'], ['白蘅君','丹初素','江停药'],
  ['陶绛雪','炉心红','青榫'], ['沈听澜','陆归舷','定星罗'], ['闻书蘅'],
];
const countryRoster = [['姚穗宁','桑晚织'],['关砚秋','朱釉娘'],['柳汀仪','裴济舟'],['苏晴棠','宁秤月']];
const localRoster = [['织锦心'],['苔衣'],[],[],['舟晚汐'],['菌小满'],['蜜九娘'],[]];
// 门内四档只将蓝图已有职责细化为不同阅读层次，不新增具名功法或特权。
const internalWork = [
  ['认识药候、分辨普通植物与成灵者，随教习整理种签并照料安全苗床。','学习移栽、病害观察与辅助功法，参与本境界能承担的药圃工作。','按实际任职管理传种、候园或外务，核对用水并指导弟子。','参与古园方案审核、传承教学与跨域协调；重大去留由宫主与相关居民共同商议。'],
  ['学习辨材、拓碑与矿道避险，在安全区域练习基本测量。','随勘测师记录岩层、检查支撑与绘制矿图，修补适合自己境界的器材。','按任职组织勘脉、校勘或修本工作，核对矿契并安排工队撤离演练。','教授高阶阵法与本源修补，复核封矿或护山方案；大陆地脉大事交庭主。'],
  ['学习记录雨量、花期与水位，跟随教习观察农事，凡人只做无需灵力的操作。','参与巡候、泉源调查和小范围阵法练习，区分观察事实与推测。','按任职管理测候站和地水事务，协调农户与邻区，复核异常数据。','主持高阶研究、教授调候与评估跨流域代价，重要方案由观主统筹。'],
  ['辨认常见药材、练习清洁和病案记录，随教习学习基本照护。','参与本境界诊疗与药材培育，跨族病症先请专门医师会诊。','按任职带行医队、管理温养房或诊室，记录疗程并转交超出能力的病例。','参与疑难会诊、审阅疗法与教授弟子；尊重患者选择，重大诊疗由山主协调。'],
  ['使用普通材料练习量尺、装配与修缸，认识火道、器身和本源的区别。','参与试釉、民用检修和适合自身境界的炼器，记录材料损耗。','按任职管理炉区、验料和带徒，安排器灵停养与维修次序。','复核大型器具、地火工程和驻国防卫方案，宗门资源由宗主统筹。'],
  ['学习绳结、旗号、水位与近岸避险，在港内完成检修见习。','参加本境界可承受的河湖航次、校图与救援演练，按船员分工协作。','按任职组织测航、搜救或舟坞工作，核对材料、天气与返航准备。','审核高风险航路、堤阵与跨大陆协作，危险大事由府主和负责队伍共同决定。'],
];
const sects = blocks(section('五、宗门与共同教养机构'), 3).map((b, i) => {
  const f = fields(b.body);
  return { name: cleanName(b.title), title: b.title.replace(/^\d+\. /, ''), type: i < 3 ? '大' : i < 6 ? '中' : '机构',
    fields: f, roster: rosterNames[i], internal: internalWork[i] ?? null };
});
const countries = blocks(section('七、四个凡国与庇护关系'), 3).map((b, i) => ({
  name: cleanName(b.title), title: b.title.replace(/^\d+\. /, ''), fields: fields(b.body), roster: countryRoster[i],
}));
const characterSection = section('九、人物设计与关系骨架');
const characters = Object.fromEntries(blocks(characterSection.split('### 9. 组织与职位对照')[0], 4).map(b => {
  const f = fields(b.body);
  const id = f['身份'].split('；');
  assert.equal(id.length, 4, `身份格式：${b.title}`);
  return [b.title, { name: b.title, gender: id[0].split('／')[0], appearance: id[0].split('／')[1],
    race: id[1], realm: id[2], role: id[3], fields: Object.fromEntries(Object.entries(f).filter(([k]) => k !== '身份')) }];
}));
const relations = characterSection.split('### 10. 人物关系骨架')[1].trim().split('\n').filter(s => s.startsWith('- '));
const secretSection = section('十、秘境设计');
const secrets = blocks(secretSection, 4).map(b => {
  const f = fields(b.body);
  const steps = b.body.split('\n').filter(s => /^- [1-4]\. /.test(s));
  assert.equal(steps.length, 4, `秘境阶段：${b.title}`);
  return { name: cleanName(b.title), important: b.title.includes('重要秘境'), steps,
    detail: b.body, brief: `- ${cleanName(b.title)}: ${f['推荐境界']}\n  入口: ${f['位置与入口']}` };
});
const ecology = blocks(section('四、八片生态与区域灵感'), 3).map((b, i) => {
  const f = fields(b.body.split('区域灵感：')[0]);
  const resources = f['普通资源'];
  const match = resources.match(/^动物(?:有)?(.+?)；植物(?:有)?(.+?)；矿(?:产|土)(?:有)?(.+?)(?:。|$)/);
  assert(match, `资源格式：${b.title}`);
  const pool = Object.fromEntries(['动物','植物','矿产'].map((k, j) => [k, match[j + 1].split('、')]));
  delete f['普通资源'];
  return { name: cleanName(b.title), title: b.title.replace(/^\d+\. /, ''), fields: f, resources: pool,
    secrets: secrets.slice(i * 3, i * 3 + 3).map(s => s.name), roster: localRoster[i] };
});
const cities = section('六、城市与聚落').split('\n').filter(s => /^\| [^ -]/.test(s)).slice(1).map(row => {
  const c = row.split('|').slice(1, -1).map(s => s.trim());
  return { name: c[0], location: c[1], life: c[2], landmarks: c[3] };
});
const overview = fields(section('一、兼容约束与大陆定位'));
delete overview['参考要素'];
const geography = section('三、大陆空间与交通');
const map = geography.match(/```mermaid[\s\S]*?```/)[0];
const routes = geography.slice(geography.indexOf('```', geography.indexOf('```') + 3) + 3).trim();
const politics = blocks(section('八、大陆政治、生产与长期矛盾'), 3);
const cohabitation = section('二、候境与万物有灵的生活');

export const data = { overview, ecology, sects, countries, cities, characters, secrets, relations, cohabitation,
  map, routes, politics: politics.map(b => `### ${b.title}\n${b.body.split('\n\n此处仅确立矛盾方向')[0]}`).join('\n\n') };
assert.equal(ecology.length, 8);
assert.equal(sects.length, 7);
assert.equal(countries.length, 4);
assert.equal(cities.length, 8);
assert.equal(Object.keys(characters).length, 32);
assert.equal(secrets.length, 24);
assert.equal(relations.length, 22);
for (const group of [...rosterNames, ...countryRoster, ...localRoster]) {
  for (const name of group) assert(characters[name], `未知人物：${name}`);
}
for (const group of countryRoster) for (const name of group) assert(/^(筑基|金丹)/.test(characters[name].realm));

// 此函数序列化到总览中；运行时仅依赖内联 DATA 和酒馆提供的两个 API。
export function build(){ return emit(normalize('灵境大陆',data)); }
if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv.includes('--check')){
    assert.equal(readFileSync(targetPath,'utf8').replace(/\r\n/g,'\n'),build(),'总览与蓝图不同步');
    console.log('灵境大陆总览与蓝图一致。');
  }else process.stdout.write('*** Begin Patch\n'+patchFile(targetPath,build())+'*** End Patch\n');
}
