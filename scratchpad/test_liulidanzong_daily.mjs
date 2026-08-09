// 琉璃丹宗日常 · 事件条目离线验证脚本
// 用法: node scratchpad/test_liulidanzong_daily.mjs
// 原理: 迷你 EJS 渲染器 + 酒馆助手函数 mock, 逐场景喂 stat_data, 断言各事件触发/静默
// 说明: 默认把 Math.random 钉在 0.99(禁随机), 只测关键词/门禁; 另有专项测随机路径
//       入宗介绍为无条件优先触发(在宗内·无大事件即触发), 其余事件测试一律先标记其已完成
import { readFileSync } from 'node:fs';

const file = '世界书/事件/琉璃丹宗/琉璃丹宗日常.txt';
const src = readFileSync(file, 'utf8');

// 钉住 Math.random(完全确定; 随机路径另有专项)
const savedRandom = Math.random;
Math.random = () => 0.99; // 禁随机

// ---------- 迷你 EJS 编译器(支持 <%_ _%> / <% %> / <%- %> / <%= %>) ----------
function compile(tpl) {
  let code = 'let __out="";\n';
  const re = /<%([_=\-]?)([\s\S]*?)([_\-]?)%>/g;
  let last = 0, m, slurpNext = false;
  const pushText = (t) => { if (t) code += `__out += ${JSON.stringify(t)};\n`; };
  while ((m = re.exec(tpl))) {
    let text = tpl.slice(last, m.index);
    if (slurpNext) text = text.replace(/^[ \t]*\r?\n/, '');
    if (m[1] === '_') text = text.replace(/[ \t]*$/, '');
    pushText(text);
    if (m[1] === '=' || m[1] === '-') code += `__out += String((${m[2]}) ?? '');\n`;
    else code += m[2] + '\n';
    slurpNext = m[3] === '_' || m[3] === '-';
    last = re.lastIndex;
  }
  let tail = tpl.slice(last);
  if (slurpNext) tail = tail.replace(/^[ \t]*\r?\n/, '');
  pushText(tail);
  code += 'return __out;';
  return code;
}

// ---------- 酒馆函数 mock ----------
function makeEnv(state, recentText = '') {
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  return {
    getMessageVar: (path, opts) => {
      const v = get(state, path);
      return v !== undefined ? v : (opts && 'defaults' in opts ? opts.defaults : undefined);
    },
    getChatMessages: () => (recentText ? [{ message: recentText }] : []),
    lastMessageId: 5,
  };
}

function render(state, recentText) {
  const env = makeEnv(state, recentText);
  const fn = new Function(...Object.keys(env), compile(src));
  return fn(...Object.values(env));
}

// ---------- 场景 ----------
const base = (事件 = {}, extra = {}) => ({
  stat_data: {
    事件: { 开启: false, 标题: '', 阶段: '', 已完成事件: [], ...事件 },
    身份: ['琉璃丹宗·外门弟子'],
    时间: { 时辰: '辰时' },
    地点: { 地域: '东土', 具体地点: '琉璃丹宗·流芳殿' },
    ...extra,
  },
});
const 夜 = { 时间: { 时辰: '亥时' } };
const 已完成 = (...names) => ({ 已完成事件: names });
// 入宗介绍无条件优先: 其余事件场景一律先标记其已完成
const 已入宗 = () => 已完成('琉璃丹宗·入宗介绍');

let pass = 0, fail = 0;
function t(name, out, mustHave = [], mustNot = []) {
  const errs = [];
  for (const s of mustHave) if (!out.includes(s)) errs.push(`缺少「${s}」`);
  for (const s of mustNot) if (out.includes(s)) errs.push(`不应含「${s}」`);
  if (errs.length) { fail++; console.log(`✗ ${name}: ${errs.join('; ')}`); }
  else { pass++; console.log(`✓ ${name}`); }
}
function countEvents(out) { return (out.match(/<event>/g) || []).length; }

// 入宗介绍: 无条件稳定触发(无关键词/任意时辰)
t('入宗介绍: 首轮稳定触发', render(base(), '今天天气不错'), ['入宗介绍', '"value": "琉璃丹宗·入宗介绍"']);
t('入宗介绍: 夜间也触发', render(base({}, 夜, { 地点: { 地域: '东土', 具体地点: '琉璃丹宗·地火窟' } }), '夜里没什么特别'), ['入宗介绍']);
t('入宗介绍: 已过不复燃', render(base(已完成('琉璃丹宗·入宗介绍')), '今天天气不错').trim(), [], ['<event>']);
// ① 门内无事件关键词 → 空输出(入宗介绍已过, 禁随机)
t('① 门内无关键词=静默', render(base(已入宗()), '今天天气不错').trim(), [], ['<event>']);
// 身份/地域门禁
t('总开关: 非琉璃丹宗身份→静默', render(base(已入宗(), { 身份: ['散修'] }), '在百草峰识药').trim(), [], ['<event>']);
t('地域: 非东土→静默', render(base(已入宗(), { 地点: { 地域: '南疆', 具体地点: '百草峰' } }), '在百草峰识药').trim(), [], ['<event>']);
// 初次识药: 白日 + 关键词
t('初次识药: 白日命中', render(base(已入宗(), { 地点: { 地域: '东土', 具体地点: '琉璃丹宗·百草峰' } }), '第一次随同门上百草峰识药'), ['初次识药', '"value": "琉璃丹宗·初次识药"']);
t('初次识药: 夜晚静默', render(base(已入宗(), 夜, { 地点: { 地域: '东土', 具体地点: '琉璃丹宗·百草峰' } }), '在百草峰识药').trim(), [], ['<event>']);
// 人物专属: 各命中
t('岐青黛·深夜送丹: 夜晚+名', render(base(已入宗(), 夜, { 地点: { 地域: '东土', 具体地点: '琉璃丹宗·流芳殿' } }), '深夜经过丹房，岐青黛'), ['深夜送丹', '"value": "琉璃丹宗·岐青黛深夜送丹"']);
t('桐绛雪·新火试炼: 夜晚+名', render(base(已入宗(), 夜, { 地点: { 地域: '东土', 具体地点: '琉璃丹宗·丹堂' } }), '桐绛雪在丹堂试异火'), ['新火试炼', '"value": "琉璃丹宗·桐绛雪新火试炼"']);
t('林蘅芷·长柄药夹: 名命中', render(base(已入宗(), { 地点: { 地域: '东土', 具体地点: '琉璃丹宗·毒堂' } }), '林蘅芷在毒堂授课'), ['长柄药夹', '"value": "琉璃丹宗·林蘅芷长柄药夹"']);
// 俞采苓: 入宗介绍+初次识药均已过才轮到
t('俞采苓·给卓青砚体检: 白日+名', render(base({ 已完成事件: ['琉璃丹宗·入宗介绍', '琉璃丹宗·初次识药'] }, { 地点: { 地域: '东土', 具体地点: '琉璃丹宗·百草峰' } }), '俞采苓要给卓青砚做体检'), ['体检', '"value": "琉璃丹宗·俞采苓卓青砚体检"']);
// 卓青砚: 夜间+药渣词(须夜晚，避免白日被"俞采苓·体检"抢触发)
t('卓青砚·炉边药渣: 夜晚+名', render(base({ 已完成事件: ['琉璃丹宗·入宗介绍', '琉璃丹宗·岐青黛深夜送丹'] }, 夜, { 地点: { 地域: '东土', 具体地点: '琉璃丹宗·丹房' } }), '深夜卓青砚蹲在炉边拣药渣'), ['炉边药渣', '"value": "琉璃丹宗·卓青砚炉边药渣"']);
// ④ 已完成后不复燃
t('④ 初次识药已过不复燃', render(base({ 已完成事件: ['琉璃丹宗·入宗介绍', '琉璃丹宗·初次识药'] }, { 地点: { 地域: '东土', 具体地点: '琉璃丹宗·百草峰' } }), '再次上百草峰识药').trim(), [], ['<event>']);
// ③ 他事件进行中静默
t('③ 大型事件进行中静默', render(base({ 开启: true, 标题: '别的事件', 阶段: '第一幕' }), '在百草峰识药').trim(), [], ['<event>']);
// 每轮最多一个事件
t('多关键词只出一个事件', (() => {
  const out = render(base(已入宗(), 夜, { 地点: { 地域: '东土', 具体地点: '琉璃丹宗·丹房' } }), '夜里在丹房，岐青黛、桐绛雪、卓青砚都在');
  return countEvents(out) === 1 ? 'OK:' + out : '多事件(' + countEvents(out) + '):' + out;
})(), ['OK:'], ['多事件(']);
// 完成令牌逐字一致
t('令牌一致', render(base({ 已完成事件: ['琉璃丹宗·入宗介绍'] }, { 地点: { 地域: '东土', 具体地点: '琉璃丹宗·百草峰' } }), '第一次上百草峰识药'), ['"value": "琉璃丹宗·初次识药"']);
// 随机路径可触发(强制随机命中; 入宗介绍已过)
Math.random = () => 0.01;
t('随机触发可用', render(base(已入宗()), '门内毫无动静的平常一日'), ['<event>'], []);
Math.random = () => 0.99;
t('禁随机下平常一日静默', render(base(已入宗()), '门内毫无动静的平常一日').trim(), [], ['<event>']);

Math.random = savedRandom;
console.log(`\n${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
