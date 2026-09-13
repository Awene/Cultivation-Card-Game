import {emit,normalize,patchFile} from './overview_star_style.mjs';
// 将已确认蓝图机械转写为自包含 EJS。运行：node scratchpad/build_taichu_overview.mjs
// --check 仅检查生成物一致性；修改蓝图格式后若断言失败，应核对解析边界再生成。
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const source = new URL('世界书/灵界/太初大陆/太初大陆蓝图.md', root);
const target = new URL('世界书/灵界/太初大陆/[mvu_plot]太初大陆总览.txt', root);
const text = readFileSync(source, 'utf8').replace(/\r\n/g, '\n');
function section(title) {
  const start = text.indexOf(`## ${title}\n`);
  assert(start >= 0, `缺少章节：${title}`);
  const end = text.indexOf('\n## ', start + 4);
  return text.slice(start, end < 0 ? undefined : end);
}
function blocks(body, depth) {
  const regex = new RegExp(`^${'#'.repeat(depth)} (.+)\\n([\\s\\S]*?)(?=^#{1,${depth}} |$(?![\\s\\S]))`, 'gm');
  return [...body.matchAll(regex)].map(m => ({ title: m[1], body: m[2].trim() }));
}
function fields(body) {
  return Object.fromEntries([...body.matchAll(/^- ([^：\n]+)：(.+)$/gm)].map(m => [m[1], m[2]]));
}
const cleanTitle = title => title.replace(/^\d+\. /, '');
const shortName = title => cleanTitle(title).split('（')[0];
const ecosystems = blocks(section('四、八大生态与区域灵感'), 3).map(b => {
  const f = fields(b.body);
  const pools = f['普通资源候选'].replace(/。.*$/, '').split('；').map(s => s.split('、'));
  assert.equal(pools.length, 3, `${b.title}资源分类`);
  const inspiration = [...b.body.matchAll(/^\d+\. (.+)$/gm)].map(m => m[1]);
  assert.equal(inspiration.length, 6);
  delete f['普通资源候选'];
  return { name: shortName(b.title), title: cleanTitle(b.title), fields: f,
    resources: { 动物: pools[0], 植物: pools[1], 矿产: pools[2] }, inspiration };
});
const characters = blocks(section('十、人物设计'), 4).map(b => {
  const f = fields(b.body);
  const identity = f['性别／类型'].match(/^([男女])／(.+?)；种族：(.+?)；境界：(.+?)。$/);
  assert(identity, `人物身份格式：${b.title}`);
  return { name: b.title, sex: identity[1], type: identity[2], race: identity[3], realm: identity[4],
    role: f['身份与位置'], appearance: f['外貌与着装'], life: f['性格与生活'],
    arts: f['所长与法宝'], purpose: f['联系与用途'] };
});
const secrets = [];
for (const b of blocks(section('十二、秘境设计'), 4)) {
  const f = fields(b.body);
  const stages = [...b.body.matchAll(/^\| ([1-4]\. .+) \| (.+) \| (.+) \| (.+) \|$/gm)]
    .map(m => ({ scene: m[1], danger: m[2], solution: m[3], reward: m[4] }));
  assert.equal(stages.length, 4, b.title);
  const name = shortName(b.title);
  secrets.push({ name, important: b.title.includes('重要秘境'), entrance: f['位置／入口'],
    realm: f['推荐境界'], purpose: f['性质与用途'], stages,
    eco: ecosystems[Math.floor(secrets.length / 3)].name });
}
const sectRoster = {
  观岳道院: ['郁见山', '邵留霜', '陆砚生'], 负岳庭: ['岳照棠', '祝玄岑', '段绣岩'],
  濡生谷: ['林漱泉', '岑汀兰', '泠芽', '荷照'], 养火宗: ['容照陶', '釉眠'],
  听澜宗: ['闻汀雪', '白渚绫'], 万程院: ['顾归遥', '程逐泉'],
};
// 生活层细化仅展开蓝图已有职责。课程是学习方向，不新增可直接领取的功法物品。
const inner = {
  观岳道院: [
    '入门：辨认一幅地形图并说明观察与猜测的区别；无灵力者先学识图、记事和器具维护。日常：抄图、核水尺、随师长走访渠社。',
    '日常：独立完成安全地段的测水与地脉记录，参与小型阵标维护；将原始记录与解释分开呈报。',
    '日常：按任职带勘察队、复核古图、教授低阶弟子；迁建建议须列明证据与地方影响。',
    '日常：依职务审核大型阵法与研究方案、协调源山和下游记录；重大护境及共约事务交院主统筹。',
  ],
  负岳庭: [
    '入门：完成与身体条件相称的负重、绳结和协作试炼，说明一项能够兑现的承诺。日常：基础体术、修护绳具、跟队守路。',
    '日常：按自身修为进行炼体与护体训练，参加有准备的护送救援；记录伤病和装备损耗。',
    '日常：按任职带队、排班、审核桥路与护具；旧约争议先交见契堂核对，不自行强迫后人履约。',
    '日常：指导高阶炼体与协作，按任职处理护境、守约和重大救援；庭主岳照棠主持日常，祝玄岑不替代现任决策。',
  ],
  濡生谷: [
    '入门：辨认基础药材、记录病人来历与生活条件，完成安全采药练习。日常：育苗、整理病案、随诊；凡人不施灵力疗术。',
    '日常：在监督下诊治符合能力的病症、培育药株、辨泉；不能把一种族疗法直接套用另一族。',
    '日常：按任职带巡诊与采药队，调度药舟、核验药材和留种；疑难伤病请高阶医修会诊。',
    '日常：会诊、传授高阶医术、审核药圃与护境安排；重大供养和庇护事务交谷主，不以职位承诺无限疗效。',
  ],
  养火宗: [
    '入门：用普通材料制作或修复一件日用器具，讲清用途和炉火风险。日常：辨土、量尺、清理炉具、学习安全停火。',
    '日常：练习本境界炼器、试釉和小型阵具，记录炉候与损耗；先验实用性再追求华丽。',
    '日常：按任职分配炉时、检查火道、带学徒、协调家窑；器灵合作须尊重已订契约。',
    '日常：审核大型炉阵、工程与新工艺，指导高阶炼器；重大火道调配与城镇影响交宗主议定。',
  ],
  听澜宗: [
    '入门：识别灯号、学会绳结和救生，完成安全近岸见习。日常：修舟、记水位、巡灯，不独自驶入险水。',
    '日常：参加护舟、测水与水下作业训练，先核风候和返程能力；内海经验不直接替代虚海知识。',
    '日常：按任职带领航队、核验封航依据、维护灯站；公布可检查的复航条件。',
    '日常：审核高阶水阵、协调上下游安全与宗门教学；大规模护境和城盟争议交宗主。',
  ],
  万程院: [
    '入门：规划一段安全行程，说明水粮、落脚处与求援方式。日常：驿舍劳作、寄信、识路、驮兽照料。',
    '日常：按实际境界参加护送、勘路与野外阵法训练，归来提交能被复核的行记。',
    '日常：按任职带队、管理驿院、调度补给与接驳；遇失踪或封路须登记最后可核实的信息。',
    '日常：审核高风险路线与护送方案、指导行修、协调各驿院；重大跨地事务交院主，不以里程直接兑换修为。',
  ],
};
const sects = blocks(section('五、六大宗门'), 3).map(b => ({ name: shortName(b.title),
  title: cleanTitle(b.title), large: b.title.includes('大型'), fields: fields(b.body),
  roster: sectRoster[shortName(b.title)], inner: inner[shortName(b.title)] }));
const countryRoster = { 承川古国: ['姚令禾', '陶素渠'], 白汀诸城盟: ['盐青蘅', '许平潮'],
  长苇泽国: ['苇清晏', '叶纫秋'], 大风部盟: ['乌兰笙', '俞铃纱'] };
const countries = blocks(section('六、凡国与庇护关系'), 3).map(b => ({ name: shortName(b.title),
  title: cleanTitle(b.title), fields: fields(b.body), roster: countryRoster[shortName(b.title)] }));
const cityRoster = { 承都: ['姚令禾','陶素渠'], 赤阶城: ['石晚缃'], 照盐城: ['盐青蘅','许平潮'],
  青井镇: ['孟听雨'], 潮根埠: ['乔映帆'], 陶都: ['阮合釉','沈暖岫'],
  浮穗城: ['苇清晏','叶纫秋'], 归泉城: ['乌兰笙','俞铃纱'], 问源关: ['邢知岫','石望川'] };
const cities = [...section('七、主要城市与地方聚落').matchAll(/^\| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)]
  .filter(m => cityRoster[m[1]]).map(m => ({ name: m[1], fields: { 位置与治理: m[2], 结构与经济: m[3], 文化与庇护: m[4] }, roster: cityRoster[m[1]] }));
const relationships = [...section('十一、人物关系骨架').matchAll(/^\d+\. (.+)$/gm)].map(m => m[1]);
const charter = section('八、大陆政治与经济联系').split('### 主要资源往来')[0].replace(/^## .+\n/, '').trim();
const custody = blocks(section('七、主要城市与地方聚落'), 3).find(b => b.title === '自治地方的庇护供养').body;
const map = section('三、空间结构与交通').match(/```mermaid\n([\s\S]*?)```/)[1];
const geography = blocks(section('三、空间结构与交通'), 3).find(b => b.title === '水系与地势').body;
const general = section('一、定位与兼容约束').split('\n').filter(l => !/^## |^- 交通：|^- 人物：/.test(l)).join('\n').trim()
  .replace('大陆公开大乘原则上预留一至两位', '公开大乘为郁见山与祝玄岑');
const daily = blocks(section('二、历史脉络与生活气质'), 3).filter(b => b.title !== '历史层次')
  .map(b => `### ${b.title}\n${b.body}`).join('\n\n');
const history = blocks(section('二、历史脉络与生活气质'), 3).find(b => b.title === '历史层次').body;
const names = new Set(characters.map(c => c.name));
assert.equal(ecosystems.length, 8); assert.equal(characters.length, 32); assert.equal(secrets.length, 24);
assert.equal(sects.length, 6); assert.equal(countries.length, 4); assert.equal(cities.length, 9);
assert.equal(relationships.length, 18);
for (const item of [...sects, ...countries, ...cities]) {
  assert(item.roster?.length, item.name);
  for (const n of item.roster) assert(names.has(n), n);
}
for (const s of sects) assert.equal(s.inner.length, 4);
export const data = { general, daily, history, geography, charter, custody, map, ecosystems, characters, secrets, sects, countries, cities, relationships };

// 此函数及静态数据内联进 entry；运行时不读取蓝图、磁盘或其他条目。
export function build(){ return emit(normalize('太初大陆',data)); }
if(process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]){
  if(process.argv.includes('--check')){
    assert.equal(readFileSync("世界书/灵界/太初大陆/[mvu_plot]太初大陆总览.txt",'utf8').replace(/\r\n/g,'\n'),build(),'总览与蓝图不同步');
    console.log('太初大陆总览与蓝图一致。');
  }else process.stdout.write('*** Begin Patch\n'+patchFile("世界书/灵界/太初大陆/[mvu_plot]太初大陆总览.txt",build())+'*** End Patch\n');
}
