// 本格修仙专用世界推进桥：业务逻辑随角色卡携带，路由插件不认识本卡规则或 MVU。
(() => {
'use strict';
const WORLD_ADVANCE_TRIGGER = '请明确以[时间推进规则]进行世界演进。';
const WORLD_ADVANCE_RULE = '[时间推进规则]';
const hours = ['子时','丑时','寅时','卯时','辰时','巳时','午时','未时','申时','酉时','戌时','亥时'];
function timeTuple(time) {
  if (!time || typeof time !== 'object') return null;
  const values = ['年','月','日'].map(k => time[k]);
  if (values.some(v => v == null || String(v).trim() === '' || !Number.isSafeInteger(Number(v)))) return null;
  const [year, month, day] = values.map(Number);
  const hour = hours.indexOf(time.时辰);
  return month >= 1 && month <= 12 && day >= 1 && day <= 30 && hour >= 0 ? [year, month, day, hour] : null;
}
function compareTime(a, b) {
  const left = timeTuple(a), right = timeTuple(b);
  if (!left || !right) return null;
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return Math.sign(left[i] - right[i]);
  return 0;
}
function worldAdvanceInterval(data) {
  const start = data?.传闻?.上次世界推进时间点, end = data?.时间;
  const order = compareTime(end, start);
  if (order === null) throw new Error('推进时间尚未初始化或日期无效，请等待 MVU 核验并检查时间');
  if (order === 0) throw new Error('尚无新的时间跨度');
  if (order < 0) throw new Error('当前时间早于上次世界推进时间，不能推进，请先检查存档时间');
  return { start: JSON.parse(JSON.stringify(start)), end: JSON.parse(JSON.stringify(end)) };
}
function worldAdvancePrompt(interval) {
  const fmt = t => `${t.年}年${t.月}月${t.日}日${t.时辰}`;
  return WORLD_ADVANCE_TRIGGER + '\n上次世界推进时间点：' + fmt(interval.start) +
    '；当前时间点：' + fmt(interval.end) +
    '。\n只推演这个已经流逝的区间，不额外推进我的时间。对关系列表中全部人物逐人输出小面板，再描绘各自经历；必要时补充世界变化。最后镜头回到当前时间点、当前地点的我，不替我行动。' +
    '\n更新相关人物与传闻：保留有效旧消息、补充新消息、清理过期内容，不泄露私密镜头。完成后在同一JSONPatch末尾将 /传闻/上次世界推进时间点 更新为 ' +
    JSON.stringify(interval.end) + '。正文目标2500—3500字，面板不计；全员展示优先，必要时允许超出。';
}


const host = window.parent;
const context = () => host.SillyTavern.getContext();
const readWorldStat = (messageId = 'latest') => host.TavernHelper.getVariables({ type: 'message', message_id: messageId })?.stat_data;
const intervalOf = record => record?.requestData?.cultivationWorldAdvance || record?.worldAdvance;
let sending = false;
let pendingInterval = null;
let unregister = null;
let registeredRouter = null;
function assertSettled() {
  const last = [...(context().chat || [])].reverse().find(m => !m.is_user && !m.is_system && intervalOf(m.extra?.crr_route));
  const interval = intervalOf(last?.extra?.crr_route);
  const comparison = interval ? compareTime(readWorldStat()?.传闻?.上次世界推进时间点, interval.end) : 0;
  if (interval && (comparison === null || comparison < 0)) throw new Error('上次世界推进的时间点尚未正确更新；请等待变量更新，或检查并重生成该轮，勿重复结算');
}
function resolveRoute({ type, input, isMainRequest }) {
  if (!isMainRequest) return null;
  pendingInterval = null;
  let sourceStat;
  if (!input.trim() && ['regenerate', 'swipe', 'continue'].includes(type)) {
    const chat = context().chat || [];
    for (let i = chat.length - 1; i >= 0; i--) {
      if (!chat[i].is_user) continue;
      input = chat[i].mes || '';
      sourceStat = i > 0 ? readWorldStat(i - 1) : undefined;
      break;
    }
    if (input.includes(WORLD_ADVANCE_TRIGGER) && !sourceStat) throw new Error('找不到重生成前的变量快照，不能使用已结算的数据重复推进');
  } else if (input.includes(WORLD_ADVANCE_TRIGGER)) {
    assertSettled();
  }
  if (!input.includes(WORLD_ADVANCE_TRIGGER)) return null;
  pendingInterval = worldAdvanceInterval(sourceStat || readWorldStat());
  return { enabled: [WORLD_ADVANCE_RULE], reason: '世界推进', data: { cultivationWorldAdvance: pendingInterval }, reuseForExtraApi: true };
}
function connect() {
  const router = host.CultivationRuleRouter;
  if (router === registeredRouter) return !!unregister;
  unregister?.();
  unregister = null;
  registeredRouter = router;
  if (typeof router?.registerFixedRouteResolver !== 'function') return false;
  unregister = router.registerFixedRouteResolver('cultivation-card/world-advance', resolveRoute);
  return true;
}
async function send() {
  if (!connect()) throw new Error('请启用支持指定路由接口的新版路由插件（0.19.5 或更新）');
  const input = host.document.querySelector('#send_textarea');
  const button = host.document.querySelector('#send_but');
  const stop = host.document.querySelector('#mes_stop');
  if (!input || !button) throw new Error('未找到酒馆输入框');
  if (sending || (stop && stop.offsetParent !== null)) throw new Error('请等待当前生成结束');
  if (input.value.trim()) throw new Error('输入框已有草稿，请先发送或保存草稿');
  assertSettled();
  const interval = worldAdvanceInterval(readWorldStat());
  // 先确认插件已启用，再写入输入框；实际路由在生成钩子里重新校验。
  const probe = host.CultivationRuleRouter.requestFixedRoute([WORLD_ADVANCE_RULE], '接口可用性检查');
  host.CultivationRuleRouter.cancelRequest(probe);
  sending = true;
  try {
    input.value = worldAdvancePrompt(interval);
    input.dispatchEvent(new host.Event('input', { bubbles: true }));
    button.click();
  } finally { setTimeout(() => { sending = false; }, 1500); }
}
const api = { send };
host.CultivationWorldAdvance = api;
connect();
// 兼容插件后加载；页面卸载时解除注册，避免切卡后残留专用逻辑。
const timer = setInterval(connect, 1000);
const source = context().eventSource;
const onUpdate = variables => {
  if (!pendingInterval || !variables?.stat_data) return;
  if (compareTime(variables.stat_data.传闻?.上次世界推进时间点, pendingInterval.end) !== 0) {
    host.toastr.warning('世界推进时间点未正确更新，请检查本轮变量或重生成；不要直接重复推进。', '世界推进', { preventDuplicates: true });
  }
};
const onChat = () => { pendingInterval = null; sending = false; };
// 专用的“仅明确要求时开启”约束也留在卡内，防止旧配置关联或模型误选。
const onEntries = payload => {
  const active = context().chatMetadata?.variables?.['路由激活规则'];
  let routed = false;
  try { routed = JSON.parse(active || '[]').includes(WORLD_ADVANCE_RULE); } catch { /* 无结果视为关闭 */ }
  if (pendingInterval && routed) return;
  const vars = context().chatMetadata?.variables;
  // 同步 EJS 可见状态，避免实际禁用但提示词仍把此规则当作开启。
  if (vars && routed) {
    for (const key of ['路由命中规则', '路由关联规则', '路由激活规则']) {
      try { vars[key] = JSON.stringify(JSON.parse(vars[key] || '[]').filter(name => name !== WORLD_ADVANCE_RULE)); } catch { /* 保留其它异常数据 */ }
    }
  }
  for (const list of [payload?.globalLore, payload?.characterLore, payload?.chatLore, payload?.personaLore]) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) if (entry.comment === WORLD_ADVANCE_RULE) entry.disable = true;
  }
};
source.on('mag_variable_update_ended', onUpdate);
source.on(context().eventTypes.CHAT_CHANGED, onChat);
source.makeLast(context().eventTypes.WORLDINFO_ENTRIES_LOADED, onEntries);
window.addEventListener('pagehide', () => {
  clearInterval(timer);
  unregister?.();
  source.removeListener('mag_variable_update_ended', onUpdate);
  source.removeListener(context().eventTypes.CHAT_CHANGED, onChat);
  source.removeListener(context().eventTypes.WORLDINFO_ENTRIES_LOADED, onEntries);
  if (host.CultivationWorldAdvance === api) delete host.CultivationWorldAdvance;
}, { once: true });
})();
