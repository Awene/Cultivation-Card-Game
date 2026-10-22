import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../预设/本格修仙/脚本/消息分区.js', import.meta.url), 'utf8');
const { MESSAGE_MARKERS: M, MESSAGE_SLOTS: S, processCultivationMessages: process, installMessageProcessing: install } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const msg = (role, content, other = {}) => ({ role, content, ...other });
const text = content => typeof content === 'string' ? content : content.filter(part => part.type === 'text').map(part => part.text).join('');
function fixture() {
  return [
    msg('system', `头部\n${M.bodyStart}\n世界\n记忆：${S.memory}\n参考：${S.reference}\n${M.historyStart}`, { name: 'header' }),
    msg('system', '远期记忆'),
    msg('user', '远期行动'),
    msg('system', M.depth900),
    msg('system', '功法资料'),
    msg('assistant', '<gametxt><now_plot>旧剧情</now_plot></gametxt>'),
    msg('user', '上一轮行动'),
    msg('system', M.depth2),
    msg('system', '本轮路由规则'),
    msg('assistant', '上轮回复'),
    msg('user', '本轮行动'),
    msg('system', `${M.historyEnd}\n运行：${S.rules}\n输出契约\n${M.bodyEnd}\n尾部`),
  ];
}

const original = fixture(), snapshot = structuredClone(original);
const result = process(original);
assert.deepEqual(original, snapshot, '纯函数不能改动输入');
assert.deepEqual(result.map(m => m.role), ['system', 'user', 'system']);
assert.equal(result[0].name, 'header');
assert.equal(result[0].content, '头部');
assert.equal(result[2].content, '尾部');
const body = result[1].content;
for (const item of ['记忆：远期记忆', '参考：功法资料', '运行：本轮路由规则', 'Participant: 远期行动', 'Participant: 上一轮行动', 'Recorder: 上轮回复', 'Participant:<Participant_input>\n本轮行动\n</Participant_input>']) assert.ok(body.includes(item), item);
assert.ok(body.indexOf('参考：功法资料') < body.indexOf('Participant: 远期行动'));
assert.ok(body.indexOf('运行：本轮路由规则') > body.indexOf('</Participant_input>'));
assert.equal(body.match(/<Participant_input>/g)?.length, 1);
assert.ok(body.includes('<gametxt><now_plot>旧剧情</now_plot></gametxt>'), '历史格式由原生正则负责');
assert.ok(!body.includes('<|本格_'));
assert.equal(process(result), null, '已组装消息不能重复处理');

for (const content of ['总结这些消息', '生成世界书', '更新变量', '用户写的 Participant: 文本']) {
  const request = [msg('user', content)], copy = structuredClone(request);
  assert.equal(process(request), null);
  assert.deepEqual(request, copy);
}
assert.equal(process(undefined), null);

const media = fixture();
const attachment = { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==', detail: 'high' } };
media[10].content = [{ type: 'text', text: '查看附件', cache_control: { type: 'ephemeral' } }, attachment];
const mediaResult = process(media)[1].content;
assert.ok(Array.isArray(mediaResult));
assert.deepEqual(mediaResult.find(p => p.type === 'image_url'), attachment);
assert.deepEqual(mediaResult.find(p => p.cache_control)?.cache_control, { type: 'ephemeral' });
assert.ok(text(mediaResult).includes('Participant:<Participant_input>\n查看附件\n</Participant_input>'));
mediaResult.find(p => p.type === 'image_url').image_url.url = 'changed';
assert.equal(attachment.image_url.url, 'data:image/png;base64,AA==');

const continuing = fixture();
continuing.splice(11, 0, msg('assistant', '续写起点'));
assert.ok(process(continuing)[1].content.includes('</Participant_input>\n\nRecorder: 续写起点'));
const emptyHistory = [msg('system', `${M.bodyStart}${S.memory}${S.reference}${M.historyStart}${M.depth900}${M.depth2}${M.historyEnd}${S.rules}空开局${M.bodyEnd}`)];
assert.equal(process(emptyHistory)[0].content, '空开局');
const preserved = fixture();
preserved[10].content = '段一\n\n\n段二';
assert.ok(process(preserved)[1].content.includes('段一\n\n\n段二'), '不压缩玩家正文空行');

for (const marker of Object.values(M)) {
  const missing = fixture().map(m => ({ ...m, content: m.content.replace(marker, '') }));
  assert.throws(() => process(missing), /本格消息分区/);
  const duplicate = fixture().map(m => ({ ...m, content: m.content.replace(marker, marker + marker) }));
  assert.throws(() => process(duplicate), /边界重复或顺序错误/);
}
for (const slot of Object.values(S)) {
  for (const replacement of ['', slot + slot]) {
    const broken = fixture().map(m => ({ ...m, content: m.content.replace(slot, replacement) }));
    assert.throws(() => process(broken), /应出现一次/);
  }
}
const tool = fixture();
tool.splice(10, 0, msg('tool', '工具结果', { tool_call_id: '1' }));
assert.throws(() => process(tool), /工具消息/);

function bus() {
  const handlers = new Map();
  const off = (event, callback) => handlers.set(event, (handlers.get(event) ?? []).filter(fn => fn !== callback));
  const on = (event, callback) => handlers.set(event, [...(handlers.get(event) ?? []), callback]);
  const last = (event, callback) => { off(event, callback); on(event, callback); };
  const emit = async (event, ...args) => { for (const callback of [...(handlers.get(event) ?? [])]) await callback(...args); };
  return { on, off, last, emit, handlers };
}
const events = Object.fromEntries(['GENERATE_AFTER_DATA', 'CHAT_COMPLETION_SETTINGS_READY', 'GENERATION_AFTER_COMMANDS', 'OAI_PRESET_CHANGED_AFTER'].map(key => [key, key]));
const eventBus = bus(), notifications = [];
let active = true;
const instance = install({ ...eventBus, events, active: () => active, notify: message => notifications.push(message) });
// 即使模板扩展较晚加载，每轮仍先展开 EJS，再执行消息分区。
eventBus.on(events.CHAT_COMPLETION_SETTINGS_READY, data => {
  for (const message of data.messages) if (typeof message.content === 'string') message.content = message.content.replace('<%= 本轮规则 %>', 'EJS规则已展开');
});
const request = { messages: fixture(), type: 'normal', stop: ['已有停止词'], assistant_prefill: '连接预填充' };
request.messages[8].content = '<%= 本轮规则 %>';
await eventBus.emit(events.GENERATION_AFTER_COMMANDS);
await eventBus.emit(events.GENERATE_AFTER_DATA, { prompt: request.messages }, false);
assert.equal(request.messages.length, fixture().length, '实际请求不能在 EJS 前合并角色');
await eventBus.emit(events.CHAT_COMPLETION_SETTINGS_READY, request);
assert.equal(request.messages.length, 3);
assert.ok(request.messages[1].content.includes('运行：EJS规则已展开'));
assert.deepEqual(request.stop, ['已有停止词']);
assert.equal(request.assistant_prefill, '连接预填充');
assert.doesNotThrow(() => JSON.stringify(request));

const preview = { prompt: fixture() };
await eventBus.emit(events.GENERATE_AFTER_DATA, preview, true);
assert.equal(preview.prompt.length, 3);
const invalid = { messages: fixture().slice(0, -1) };
await eventBus.emit(events.CHAT_COMPLETION_SETTINGS_READY, invalid);
assert.equal(notifications.length, 1);
assert.throws(() => JSON.stringify(invalid), /本格消息分区/);
const auxiliary = { messages: [msg('user', '总结')] };
await eventBus.emit(events.CHAT_COMPLETION_SETTINGS_READY, auxiliary);
assert.equal(JSON.stringify(auxiliary), '{"messages":[{"role":"user","content":"总结"}]}');
active = false;
await eventBus.emit(events.OAI_PRESET_CHANGED_AFTER);
const afterSwitch = { messages: fixture() };
await eventBus.emit(events.CHAT_COMPLETION_SETTINGS_READY, afterSwitch);
assert.equal(afterSwitch.messages.length, fixture().length);
instance.dispose();
assert.equal((eventBus.handlers.get(events.GENERATE_AFTER_DATA) ?? []).length, 0);
assert.equal((eventBus.handlers.get(events.CHAT_COMPLETION_SETTINGS_READY) ?? []).length, 1, '卸载保留其他扩展监听');

console.log('消息分区回归通过：七段三槽、历史与多模态、EJS时序、辅助API透传、结构错误阻断、卸载。');
