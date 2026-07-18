// 五毒教日常事件合集 离线验证 (同 test_event.mjs 的迷你EJS渲染器)
// 用法: node scratchpad/test_wudu_daily.mjs
import { readFileSync } from 'node:fs';
const src = readFileSync('世界书/事件/五毒教/五毒教日常.txt', 'utf8');

function compile(tpl) {
  let code = 'let __out="";\n';
  const re = /<%([_=\-]?)([\s\S]*?)([_\-]?)%>/g;
  let last = 0, m, slurp = false;
  const push = (t) => { if (t) code += `__out += ${JSON.stringify(t)};\n`; };
  while ((m = re.exec(tpl))) {
    let text = tpl.slice(last, m.index);
    if (slurp) text = text.replace(/^[ \t]*\r?\n/, '');
    if (m[1] === '_') text = text.replace(/[ \t]*$/, '');
    push(text);
    if (m[1] === '=' || m[1] === '-') code += `__out += String((${m[2]}) ?? '');\n`;
    else code += m[2] + '\n';
    slurp = m[3] === '_' || m[3] === '-';
    last = re.lastIndex;
  }
  let tail = tpl.slice(last);
  if (slurp) tail = tail.replace(/^[ \t]*\r?\n/, '');
  push(tail);
  return code + 'return __out;';
}
function makeEnv(state, recent, rnd = 0) {
  const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
  const M = Object.create(Math); // 保留 Math.max/floor 等(原型链), 仅覆盖 random
  M.random = () => rnd;
  return {
    getMessageVar: (p, opt) => { const v = get(state, p); return v !== undefined ? v : (opt && 'defaults' in opt ? opt.defaults : undefined); },
    getChatMessages: () => (recent ? [{ message: recent }] : []),
    lastMessageId: 5, Math: M,
  };
}
function render(state, recent, rnd = 0) {
  const env = makeEnv(state, recent, rnd);
  return new Function(...Object.keys(env), compile(src))(...Object.values(env));
}
const base = (ev = {}, extra = {}) => ({ stat_data: {
  事件: { 开启: false, 标题: '', 阶段: '', 已完成事件: [], ...ev },
  身份: ['五毒教·外门弟子'], 修炼进度: { 境界: '炼气三层' },
  时间: { 时辰: '午时' }, 地点: { 具体地点: '五毒教·百草瘴' }, ...extra,
}});
let pass = 0, fail = 0;
const t = (n, out, has = [], not = []) => {
  const e = [];
  for (const s of has) if (!out.includes(s)) e.push(`缺「${s}」`);
  for (const s of not) if (out.includes(s)) e.push(`不应含「${s}」`);
  e.length ? (fail++, console.log(`✗ ${n}: ${e.join('; ')}`)) : (pass++, console.log(`✓ ${n}`));
};

// —— 总开关 ——
t('总开关: 非五毒身份→全静默', render(base({}, { 身份: ['散修'] }), '蓝幽月 百草瘴').trim(), [], ['<event>']);
t('总开关: 进行中大事件→静默', render(base({ 标题: '梦茧' }), '蓝幽月 百草瘴').trim(), [], ['<event>']);
// —— 偷糖记(炼气) ——
t('偷糖记: 炼气+关键词触发', render(base({}, {}), '{{user}}路过百草瘴看见蓝幽月'), ['偷嘴的圣女', '偷糖记'], []);
t('偷糖记: 筑基不触发(境界越限)', render(base({}, { 修炼进度: { 境界: '筑基初期' } }), '百草瘴 蓝幽月').trim(), [], ['偷嘴的圣女']);
t('偷糖记: 已做过不复燃', render(base({ 已完成事件: ['偷糖记'] }), '百草瘴 蓝幽月', 0).trim(), [], ['偷嘴的圣女']);
// —— 试毒场(夜+灵堂) ——
t('试毒场: 夜晚+灵堂触发', render(base({}, { 时间: { 时辰: '子时' } }), '{{user}}深夜路过灵堂'), ['独自试毒'], []);
t('试毒场: 白天灵堂不触发', render(base({}, { 时间: { 时辰: '午时' } }), '{{user}}路过灵堂').trim(), [], ['独自试毒']);
// —— 过去的影子(蓝幽月+修炼) ——
t('过去的影子: 蓝幽月旁修炼触发', render(base(), '{{user}}在蓝幽月身边打坐修炼'), ['入梦', '过去的影子'], []);
// —— 毒膳堂 ——
t('毒膳堂: 膳堂关键词触发', render(base(), '{{user}}第一次去膳堂用饭'), ['五毒膳堂'], []);
// —— 蟾佩刮金 ——
t('蟾佩刮金: 账房关键词触发', render(base(), '{{user}}被带去账房参观'), ['账房', '詹金蟾'], []);
// —— 五部演武·预告(筑基+已完成梦茧) ——
t('演武预告: 筑基+已通梦茧+修炼触发', render(base({ 已完成事件: ['梦茧'] }, { 修炼进度: { 境界: '筑基后期' } }), '{{user}}修炼出关'), ['五部演武', '五部演武·预告'], []);
t('演武预告: 未完成梦茧不触发', render(base({}, { 修炼进度: { 境界: '筑基后期' } }), '{{user}}修炼出关', 0).trim(), [], ['五部演武']);
// —— 断供(金丹) ——
t('断供: 金丹+宗内触发', render(base({}, { 修炼进度: { 境界: '金丹中期' } }), '{{user}}正在神木殿宗内'), ['断供', '千形宗'], []);
t('断供: 筑基不触发(境界不足)', render(base({}, { 修炼进度: { 境界: '筑基后期' } }), '神木殿 宗内', 0).trim(), [], ['急报']);

console.log(`\n${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
