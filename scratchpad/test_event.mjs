// 事件条目离线验证脚本(事件写作规范.md 第七步)
// 用法: node scratchpad/test_event.mjs [事件文件路径]
// 原理: 迷你 EJS 渲染器 + 酒馆助手函数 mock, 逐场景喂 stat_data, 断言各阶段渲染行为
import { readFileSync } from 'node:fs';

const file = process.argv[2] || '世界书/事件/梦茧.txt';
const src = readFileSync(file, 'utf8');

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
    身份: ['五毒教·外门弟子'],
    修炼进度: { 境界: '筑基初期' },
    地点: { 具体地点: '五毒教·炼蛊池' },
    ...extra,
  },
});
const 全毒 = { 蛇: true, 蜈: true, 蝎: true, 蟾: true, 虎: true, 知情: 0, 解法: false };

let pass = 0, fail = 0;
function t(name, out, mustHave = [], mustNot = []) {
  const errs = [];
  for (const s of mustHave) if (!out.includes(s)) errs.push(`缺少「${s}」`);
  for (const s of mustNot) if (out.includes(s)) errs.push(`不应含「${s}」`);
  if (errs.length) { fail++; console.log(`✗ ${name}: ${errs.join('; ')}`); }
  else { pass++; console.log(`✓ ${name}`); }
}

// ① 无事件·无关键词 → 空输出
t('① 无事件+无关键词=静默', render(base(), '今天天气不错').trim(), [], ['<event>']);
// 触发: 关键词命中
t('触发器: 结蛊语境触发', render(base(), '长老让{{user}}准备结本命蛊'), ['结本命蛊', '"path": "/事件/标题", "value": "梦茧"', '"path": "/灵兽/梦茧"'], ["将'事件"]);
// 触发被境界拦截
t('触发器: 炼气不触发', render(base({}, { 修炼进度: { 境界: '炼气三层' } }), '准备结本命蛊').trim(), [], ['<event>']);
// ④ 已通关不复燃
t('④ 已通关不复燃', render(base({ 已完成事件: ['梦茧'] }), '再次结蛊 本命蛊').trim(), [], ['<event>']);
// ③ 他事件进行中: 触发器与主体都静默
t('③ 他事件进行中静默', render(base({ 开启: true, 标题: '别的事件', 阶段: '第一幕' }), '结本命蛊').trim(), [], ['<event>']);
// ② 各阶段只渲染自身
t('② 茧中人', render(base({ 开启: true, 标题: '梦茧', 阶段: '茧中人' })), ['初次相认', '五毒之约'], ['集毒进度', '最终解封']);
t('② 集毒·中枢(无关键词)', render(base({ 开启: true, 标题: '梦茧', 阶段: '集毒', 进度: { 蛇: true, 知情: 1 } })), ['集毒进度', '1/5', '蜈毒'], ['佘青丝冷淡', '最终解封']);
t('② 集毒·蛇关(关键词)', render(base({ 开启: true, 标题: '梦茧', 阶段: '集毒', 进度: {} }), '{{user}}去灵蛇部找佘青丝'), ['佘青丝', '蝶信摄心'], ['最终解封']);
t('② 集毒·五毒已齐提示', render(base({ 开启: true, 标题: '梦茧', 阶段: '集毒', 进度: 全毒 })), ['五毒已齐', '5/5'], []);
t('② 抉择(已集齐)', render(base({ 开启: true, 标题: '梦茧', 阶段: '抉择', 进度: 全毒 })), ['完全解开封印', '结局·化蝶', '结局·献祭'], ['集毒进度']);
t('② 抉择(未集齐)无化蝶项', render(base({ 开启: true, 标题: '梦茧', 阶段: '抉择', 进度: { 蛇: true } })), ['五毒未齐'], ['结局·化蝶']);
t('② 结局·化蝶(有解法=送别)', render(base({ 开启: true, 标题: '梦茧', 阶段: '结局·化蝶', 进度: { ...全毒, 知情: 2, 解法: true } })), ['送别', '归蝶残鳞'], ['涂炭', '血蝶毒翼']);
t('② 结局·化蝶(无解法=涂炭)', render(base({ 开启: true, 标题: '梦茧', 阶段: '结局·化蝶', 进度: 全毒 })), ['涂炭', '血蝶毒翼'], ['送别']);
t('② 结局·茧中', render(base({ 开启: true, 标题: '梦茧', 阶段: '结局·茧中', 进度: 全毒 })), ['庄周梦蝶', '梦茧幻蝶佩'], ['血蝶毒翼']);
t('② 结局·献祭', render(base({ 开启: true, 标题: '梦茧', 阶段: '结局·献祭', 进度: { 蛇: true } })), ['神木殿·告发'], ['破茧']);
// 进行中不重复触发开场
t('进行中不重复触发', render(base({ 开启: true, 标题: '梦茧', 阶段: '集毒', 进度: {} }), '又聊到结本命蛊'), [], ['结本命蛊之时']);
// 归档指令为正式 JSON Patch 且无中文转述残留
t('归档为正式JSONPatch', render(base({ 开启: true, 标题: '梦茧', 阶段: '结局·茧中', 进度: 全毒 })), ['"op": "insert", "path": "/事件/已完成事件/-", "value": "梦茧"', '"op": "remove", "path": "/事件/进度"'], ['(add)', "将'事件"]);
t('化蝶结局含move迁移', render(base({ 开启: true, 标题: '梦茧', 阶段: '结局·化蝶', 进度: 全毒 })), ['"op": "move", "from": "/灵兽/梦茧", "to": "/关系列表/血蝶"'], ["将'事件"]);

console.log(`\n${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
