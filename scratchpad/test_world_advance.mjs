import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../tavern_helper_template-main/package.json', import.meta.url));
const _ = require('lodash');
const { z } = require('zod');
const YAML = require('yaml');
// These templates only use plain EJS code/interpolation blocks; evaluate both branches
// without installing anything into the user's front-end dependency tree.
const ejs = { render(source, values) {
  let code = 'let out = "";\n', cursor = 0;
  for (const match of source.matchAll(/<%([_=\-]?)([\s\S]*?)(?:[_\-])?%>/g)) {
    code += 'out += ' + JSON.stringify(source.slice(cursor, match.index)) + ';\n';
    code += ['=', '-'].includes(match[1]) ? 'out += (' + match[2] + ');\n' : match[2] + '\n';
    cursor = match.index + match[0].length;
  }
  code += 'out += ' + JSON.stringify(source.slice(cursor)) + '; return out;';
  return new Function(...Object.keys(values), code)(...Object.values(values));
} };
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const cardSource = read('../脚本/【本格修仙】世界推进.js');
const pure = cardSource.slice(cardSource.indexOf('const WORLD_ADVANCE_TRIGGER'), cardSource.indexOf('const host = window.parent;'));
const logic = await import('data:text/javascript;base64,' + Buffer.from(pure + '\nexport {WORLD_ADVANCE_TRIGGER, WORLD_ADVANCE_RULE, compareTime, worldAdvanceInterval, worldAdvancePrompt};').toString('base64'));
const date = (day = 1, hour = '午时') => ({ 年: 7200, 月: 4, 日: day, 时辰: hour });
const data = { 时间: date(1, '未时'), 传闻: { 上次世界推进时间点: date(), 条目: [] } };
assert.equal(logic.compareTime(date(1, '未时'), date()), 1);
assert.equal(logic.compareTime(date(1, '子时'), date(1, '亥时')), -1);
assert.equal(logic.compareTime({ ...date(), 月: 13 }, date()), null);
assert.equal(logic.compareTime({ ...date(), 年: '' }, date()), null);
assert.throws(() => logic.worldAdvanceInterval({ ...data, 时间: date() }), /尚无/);
assert.throws(() => logic.worldAdvanceInterval({ ...data, 时间: date(1, '子时') }), /早于/);
assert.ok(logic.worldAdvancePrompt(logic.worldAdvanceInterval(data)).startsWith(logic.WORLD_ADVANCE_TRIGGER));

const events = new Map();
const schemaCtx = { _, z, YAML, console, eventOn: (name, fn) => events.set(name, fn), registerMvuSchema() {}, $: fn => fn() };
vm.createContext(schemaCtx);
vm.runInContext(read('../脚本/变量结构.js').replace(/^import .*?;\r?\n/, '').replace('export const Schema', 'const Schema') + '\nthis.schema = Schema;', schemaCtx);
const entry = { id: 'old', 时间区间: { 起: date(), 止: date(2) }, 世界: '凡界', 地域: '东土', 地点: '某城', 类别: '日常', 内容: '旧消息', 难度: '炼气初期' };
const parsed = schemaCtx.schema.parse({ 传闻: [entry] });
assert.equal(parsed.传闻.条目.旧消息.内容, '某城：旧消息');
assert.deepEqual(Object.keys(parsed.传闻.条目.旧消息).sort(), ['内容', '类别', '难度'].sort());
const duplicates = schemaCtx.schema.parse({ 传闻: { 上次世界推进时间点: date(), 条目: [entry, entry] } });
assert.deepEqual(Object.keys(duplicates.传闻.条目), ['旧消息', '旧消息（2）']);
assert.deepEqual(schemaCtx.schema.parse(duplicates), duplicates);
const current = schemaCtx.schema.parse({ 传闻: { 条目: { '坊市公告': { 类别: '坊市集会', 内容: '东土月底开市', 难度: '炼气初期' } } } });
assert.equal(current.传闻.条目.坊市公告.内容, '东土月底开市');
const renamed = schemaCtx.schema.parse({ 传闻: [{ ...entry, 类别: '通缉魔修' }, { ...entry, 类别: '灵植奇遇' }] });
assert.deepEqual(Object.values(renamed.传闻.条目).map(x=>x.类别), ['通缉逃犯', '素材奇遇']);
assert.equal(parsed.传闻.上次世界推进时间点, null);
assert.equal(schemaCtx.schema.parse({ 传闻: { 上次世界推进时间点: {}, 条目: [] } }).传闻.上次世界推进时间点, null);
assert.deepEqual(schemaCtx.schema.parse(parsed), parsed);
const oldData = { stat_data: { 传闻: [entry] } };
vm.runInContext('this.repair = repairMissingSchemaContainers', schemaCtx);
schemaCtx.repair(oldData);
assert.equal(oldData.stat_data.传闻.条目.旧消息.内容, '某城：旧消息');

const verifierCtx = { _, console, $() {}, setTimeout() {}, clearTimeout() {}, eventOn() {}, waitGlobalInitialized: async () => {} };
vm.createContext(verifierCtx);
const verifier = read('../脚本/【本格修仙】MVU核验.js').replace('  async function verifyMvu()', '  globalThis.verifyForTest = verifyStatData;\n  async function verifyMvu()');
vm.runInContext(verifier, verifierCtx);
const old = { 时间: date(), 传闻: [entry] };
verifierCtx.verifyForTest(old);
assert.equal(old.传闻.条目.旧消息.内容, '某城：旧消息');
assert.deepEqual(JSON.parse(JSON.stringify(old.传闻.上次世界推进时间点)), date());
old.时间 = date(2);
verifierCtx.verifyForTest(old);
assert.deepEqual(JSON.parse(JSON.stringify(old.传闻.上次世界推进时间点)), date());

for (const active of [[], ['[时间推进规则]']]) {
  const context = { _, YAML, getvar: () => JSON.stringify(active), getMessageVar: () => data };
  const rules = ejs.render(read('../世界书/变量/[mvu_update]变量更新规则.yaml'), context);
  assert.equal(rules.includes('上次世界推进时间点: *time'), active.length > 0);
  assert.equal(rules.includes('本轮禁止更新'), active.length === 0);
  const prompt = ejs.render(read('../世界书/变量/[mvu_update]变量输出列表（额外API开）.ejs'), context);
  assert.equal(prompt.includes('上次世界推进时间点'), active.length > 0);
  const length = ejs.render(read('../预设/本格修仙/条目/⚙️语言字数设置.txt'), context);
  assert.equal(length.includes('2500-3500'), active.length > 0);
}

const config = JSON.parse(read('../插件/cultivation-rule-router-config.json'));
const rumorRule = read('../世界书/变量/[mvu_update]变量更新规则.yaml');
assert.ok(!ejs.render(rumorRule, { getvar: () => '[]' }).includes('RULE_传闻类型表'));
assert.ok(!ejs.render(rumorRule, { getvar: () => 'invalid-json' }).includes('RULE_传闻类型表'));
const renderedRumors = ejs.render(rumorRule, { getvar: () => '["[时间推进规则]"]' });
assert.ok(renderedRumors.includes('[传闻标题: string]'));
const categories = [...renderedRumors.matchAll(/^\s*# \| ([^|]+) \|/gm)].map(x => x[1].trim()).filter(x => !['类别', '---'].includes(x));
assert.deepEqual(categories, ['秘境传闻', '高额悬赏', '妖兽异动', '通缉逃犯', '宝物现世', '素材奇遇', '坊市集会', '灵气潮汐', '古迹奇谭', '时空裂缝']);
assert.ok(renderedRumors.includes('维护10~15条传闻'));
assert.ok(renderedRumors.includes('难度: string; # 大境界+小境界'));
assert.ok(renderedRumors.includes('从 *RULE_传闻类型表 中选择'));
assert.ok(!read('../本格修仙.yaml').includes('名称: "[mvu_update][传闻更新规则]"'));
for (const rules of Object.values(config.filters)) for (const item of Object.values(rules)) assert.ok(!item.linked.includes('[时间推进规则]'));

// 路由端集成模拟：验证固定选择、关联关闭、额外 API、下一轮与时间拦截。
let stopped = 0, flashes = 0;
const input = { value: logic.WORLD_ADVANCE_TRIGGER };
const chat = [{ is_user: false, mes: '此前剧情' }];
const host = { chat, chatMetadata: { variables: {} }, stopGeneration: () => stopped++, saveChat: async () => {} };
const settings = { enabled: true, extraApiMode: 'skip' };
const routeCtx = { ...logic, console, setTimeout: () => 0, clearTimeout() {}, window: { TavernHelper: { getVariables: () => ({ stat_data: data }) } }, document: { querySelector: () => input }, SillyTavern: { getContext: () => host } };
vm.createContext(routeCtx);
let router = read('../../cultivation-rule-router/index.js').replace(/^import .*?from '\.\/world-advance.js';\r?\n/m, '');
router = router.slice(0, router.lastIndexOf('\nif (globalThis.SillyTavern?.getContext)'));
vm.runInContext(router + '\nthis.test = { apply: applyRouting, before: onBeforeGeneration, loaded: onEntriesLoaded, received: onMessageReceived, getRecord: () => pendingRoute, getHide: () => [...hideSet] };', routeCtx);
routeCtx.host = host; routeCtx.testSettings = settings;
routeCtx.candidates = [
  { book: 'book', uid: 1, comment: '[时间推进规则]', linked: [3] },
  { book: 'book', uid: 2, comment: '[战斗规则]', linked: [] },
];
vm.runInContext("ctx = host; settings = () => testSettings; gatherCandidates = async () => ({candidates, byBook: {book: [{uid:3,comment:'常驻规则'}]}}); toast = () => ({info(){},warning(){},success(){}}); recordExtraApiRun = () => {};", routeCtx);
const cardEvents = new Map();
host.eventSource = { on: (name, fn) => cardEvents.set(name, fn), makeLast: (name, fn) => cardEvents.set(name, fn), removeListener: name => cardEvents.delete(name) };
host.eventTypes = { CHAT_CHANGED: 'chat', WORLDINFO_ENTRIES_LOADED: 'entries' };
routeCtx.window.SillyTavern = routeCtx.SillyTavern;
routeCtx.window.document = routeCtx.document;
routeCtx.window.Event = class {};
let cleanup;
const cardCtx = { window: { parent: routeCtx.window, addEventListener: (_, fn) => { cleanup = fn; } }, setTimeout: () => 0, setInterval: () => 0, clearInterval() {} };
vm.createContext(cardCtx);
vm.runInContext(cardSource, cardCtx);
await routeCtx.test.before('normal', {}, false);
assert.deepEqual([...routeCtx.test.getRecord().kept], ['[时间推进规则]']);
assert.deepEqual([...routeCtx.test.getRecord().linked], []);
assert.deepEqual([...routeCtx.test.getHide()], ['book::2']);
input.value = '';
await routeCtx.test.before('normal', {}, false);
assert.ok(host.chatMetadata.variables['路由激活规则'].includes('[时间推进规则]'));
const scan = { characterLore: [{ world: 'book', uid: 1, comment: '[时间推进规则]', disable: true, constant: false }, { world: 'book', uid: 2, comment: '[战斗规则]', disable: false }] };
routeCtx.test.loaded(scan);
assert.equal(scan.characterLore[0].constant, true);
assert.equal(scan.characterLore[0].disable, false);
assert.equal(scan.characterLore[1].disable, true);
input.value = logic.WORLD_ADVANCE_TRIGGER;
data.时间 = date();
await routeCtx.test.before('normal', {}, false);
assert.equal(stopped, 1);
assert.equal(host.chatMetadata.variables['路由激活规则'], '[]');
data.时间 = date(1, '子时');
await routeCtx.test.before('normal', {}, false);
assert.equal(stopped, 2);
// 通用插件不识别时间规则；卡侧才负责非明确要求时禁止其注入。
const normalCandidates = [...routeCtx.candidates];
normalCandidates[1] = { ...normalCandidates[1], linked: [1] };
routeCtx.test.apply(new Set([1, 2]), normalCandidates, { book: [{ uid: 1, comment: '[时间推进规则]' }] }, { rememberMain: true });
assert.equal(routeCtx.test.getRecord().kept.includes('[时间推进规则]'), true);
const ordinaryScan = { characterLore: [{ comment: '[时间推进规则]', disable: false }] };
cardEvents.get('entries')(ordinaryScan);
assert.equal(ordinaryScan.characterLore[0].disable, true);
// 重生成必须使用玩家指令之前的变量，而不是已经结算完的最新变量。
const beforeWorld = { 时间: date(1, '未时'), 传闻: { 上次世界推进时间点: date(), 条目: [] } };
host.chat = [{ is_user: false }, { is_user: true, mes: logic.WORLD_ADVANCE_TRIGGER }, { is_user: false }];
input.value = '';
routeCtx.window.TavernHelper.getVariables = option => ({ stat_data: option.message_id === 0 ? beforeWorld : { 时间: date(1, '未时'), 传闻: { 上次世界推进时间点: date(1, '未时'), 条目: [] } } });
await routeCtx.test.before('regenerate', {}, false);
assert.equal(routeCtx.test.getRecord().requestData.cultivationWorldAdvance.start.时辰, '午时');
assert.equal(routeCtx.test.getRecord().requestData.cultivationWorldAdvance.end.时辰, '未时');
assert.equal(stopped, 2);
// 真正的按钮发送函数：保留草稿、防双击、不提前修改推进时间。
host.chat = [];
routeCtx.window.TavernHelper.getVariables = () => ({ stat_data: beforeWorld });
let sends = 0;
routeCtx.Event = class {};
input.dispatchEvent = () => {};
routeCtx.document.querySelector = selector => selector === '#send_textarea' ? input : selector === '#send_but' ? { click: () => sends++ } : null;
input.value = '未发送草稿';
await assert.rejects(routeCtx.window.CultivationWorldAdvance.send(), /草稿/);
assert.equal(input.value, '未发送草稿');
input.value = '';
await routeCtx.window.CultivationWorldAdvance.send();
assert.equal(sends, 1);
assert.ok(input.value.startsWith(logic.WORLD_ADVANCE_TRIGGER));
assert.equal(beforeWorld.传闻.上次世界推进时间点.时辰, '午时');
await assert.rejects(routeCtx.window.CultivationWorldAdvance.send(), /等待/);
// 卸载后既无按钮桥，也不再影响其他卡。
cleanup();
assert.equal(routeCtx.window.CultivationWorldAdvance, undefined);
assert.equal(cardEvents.size, 0);
assert.equal(vm.runInContext('fixedRouteResolvers.size', routeCtx), 0);
assert.ok(!/WORLD_ADVANCE|worldAdvance|世界推进|传闻/.test(router));
// 非本卡条目同样支持固定启用，不进行任何业务解释。
routeCtx.window.CultivationRuleRouter.requestFixedRoute(['[战斗规则]']);
input.value = '普通请求';
await routeCtx.test.before('normal', {}, false);
assert.deepEqual([...routeCtx.test.getRecord().kept], ['[战斗规则]']);
const genericScan = { characterLore: [{ world: 'book', uid: 2, comment: '[战斗规则]', disable: true, constant: false }] };
routeCtx.test.loaded(genericScan);
assert.equal(genericScan.characterLore[0].disable, false);
assert.equal(genericScan.characterLore[0].constant, true);
console.log('PASS: time validation, migration, verifier, EJS gating, config, fixed routing and extra API');

// 编译真实 Vue 组件，验证 script setup 与模板。
const compiler = require('vue/compiler-sfc');
const vue = read('../../tavern_helper_template-main/src/修仙状态栏/pages/PageRumors.vue');
const { descriptor, errors } = compiler.parse(vue);
assert.equal(errors.length, 0);
compiler.compileScript(descriptor, { id: 'world-advance-test' });
const compiled = compiler.compileTemplate({ source: descriptor.template.content, filename: 'PageRumors.vue', id: 'world-advance-test' });
assert.equal(compiled.errors.length, 0);
console.log('PASS: PageRumors Vue component compiles');
