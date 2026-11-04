import assert from 'node:assert/strict';
import {
  HEADER_NOISE_MACRO_NAME, HEADER_NOISE_MACRO, DEFAULT_HEADER_NOISE_SETTINGS,
  normalizeHeaderNoiseSettings, buildHeaderNoise, installHeaderNoise,
} from '../预设/本格修仙/脚本/头部噪声.js';

assert.equal(HEADER_NOISE_MACRO, '{{bengexiuxian_prompt_noise}}');
assert.deepEqual(normalizeHeaderNoiseSettings(), DEFAULT_HEADER_NOISE_SETTINGS);
assert.deepEqual(normalizeHeaderNoiseSettings({ 模式: 'fixed', 段数: '19', 固定种子: 'custom' }),
  { mode: 'fixed', segments: 19, seed: 'custom' });
for (const [count, expected] of [[0, 10], [9, 10], [10, 10], [23.6, 24], [48, 48], [100, 48], [Infinity, 10], ['bad', 10]]) {
  const text = buildHeaderNoise({ 段数: count });
  assert.equal((text.match(/\[Diagnostic block \d+\]/g) ?? []).length, expected);
  assert.equal(new Set(text.match(/^sample-\d+/gm)).size, expected, '同一份不重复抽段');
}
const standard = buildHeaderNoise();
assert.equal(standard, buildHeaderNoise());
assert.equal(buildHeaderNoise({ seed: 'a' }), buildHeaderNoise({}, 'a'));
assert.notEqual(buildHeaderNoise({}, 'a'), buildHeaderNoise({}, 'b'));
assert.ok(standard.startsWith('Diagnostic padding;'));
assert.ok(standard.includes('<noise_padding>') && standard.endsWith('</noise_padding>'));
assert.ok(!/\{\{|<%|https?:\/\/|<\|本格_/.test(standard));

const eventNames = ['GENERATION_AFTER_COMMANDS', 'GENERATION_ENDED', 'GENERATION_STOPPED', 'CHAT_CHANGED',
  'OAI_PRESET_CHANGED_AFTER', 'CHAT_COMPLETION_SETTINGS_READY'];
const events = Object.fromEntries(eventNames.map(name => [name, name]));
const handlers = new Map(), macros = new Map(), notifications = [];
const on = (event, callback) => handlers.set(event, [...handlers.get(event) ?? [], callback]);
const off = (event, callback) => handlers.set(event, (handlers.get(event) ?? []).filter(item => item !== callback));
const emit = (event, ...args) => { for (const callback of [...handlers.get(event) ?? []]) callback(...args); };
let active = true, origin = 'chat-a', settings = { 模式: 'random', 段数: 10, 固定种子: 'preview' }, seed = 0;
const install = extra => installHeaderNoise({
  registerMacro: (name, callback) => macros.set(name, callback), unregisterMacro: name => macros.delete(name),
  on, off, events, readSettings: () => settings, active: () => active, contextKey: () => origin,
  createSeed: () => `round-${++seed}`, notify: message => notifications.push(message), ...extra,
});
const instance = install();
assert.ok(macros.has(HEADER_NOISE_MACRO_NAME), '注册为原生宏');
const expand = () => macros.get(HEADER_NOISE_MACRO_NAME)();
const preview = expand();
assert.equal(preview, buildHeaderNoise(settings), '计数/预览可在生成前同步展开');
assert.equal(expand(), preview);
emit(events.GENERATION_AFTER_COMMANDS, 'normal', {}, true);
assert.equal(expand(), preview, '预览事件不重新抽取');
emit(events.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
const first = expand();
assert.notEqual(first, preview);
assert.equal(expand(), first, '同轮计数与发送一致');
emit(events.GENERATION_AFTER_COMMANDS, 'quiet', {}, false);
assert.equal(expand(), first, '辅助请求不改变主请求的准备结果');
settings = { ...settings, 段数: 48 };
assert.equal(expand(), first, '生成过程中修改配置不改变本轮');
emit(events.GENERATION_ENDED);
emit(events.GENERATION_AFTER_COMMANDS, 'swipe');
const second = expand();
assert.notEqual(second, first);
assert.equal((second.match(/\[Diagnostic block \d+\]/g) ?? []).length, 48);
emit(events.GENERATION_STOPPED);
emit(events.GENERATION_AFTER_COMMANDS, 'regenerate');
assert.notEqual(expand(), second, '停止后的重试重新抽取');

settings = { 模式: 'fixed', 段数: 10, 固定种子: 'shared-seed' };
emit(events.GENERATION_AFTER_COMMANDS, 'normal');
const fixed = expand();
assert.equal(fixed, buildHeaderNoise(settings));
emit(events.GENERATION_ENDED);
emit(events.GENERATION_AFTER_COMMANDS, 'continue');
assert.equal(expand(), fixed, 'fixed跨请求一致');
const countBefore = seed;
emit(events.GENERATION_AFTER_COMMANDS, 'normal');
assert.equal(seed, countBefore, 'fixed不需要随机种子');
settings = { ...settings, 固定种子: 'other' };
origin = 'chat-b';
emit(events.CHAT_CHANGED);
assert.equal(expand(), buildHeaderNoise(settings), '切换聊天不复用前一个上下文');

const request = { messages: [{ role: 'system', content: fixed }, { role: 'user', content: '玩家输入' }] };
const snapshot = structuredClone(request);
emit(events.CHAT_COMPLETION_SETTINGS_READY, request);
assert.deepEqual(request, snapshot, '已展开请求不另加或重排消息');
assert.doesNotThrow(() => JSON.stringify(request));
const unresolved = { messages: [{ role: 'system', content: HEADER_NOISE_MACRO }] };
emit(events.CHAT_COMPLETION_SETTINGS_READY, unresolved);
assert.throws(() => JSON.stringify(unresolved), /头部噪声未展开/);
assert.equal(notifications.length, 1);

active = false;
assert.equal(expand(), '');
emit(events.OAI_PRESET_CHANGED_AFTER);
assert.ok(!macros.has(HEADER_NOISE_MACRO_NAME));
assert.ok([...handlers.values()].every(list => list.length === 0), '卸载清除事件与宏');
instance.dispose();

active = true;
settings = { 模式: 'random' };
const broken = install({ createSeed: () => { throw new Error('seed failure'); } });
emit(events.GENERATION_AFTER_COMMANDS, 'normal');
const failed = { messages: [{ role: 'system', content: expand() }] };
emit(events.CHAT_COMPLETION_SETTINGS_READY, failed);
assert.throws(() => JSON.stringify(failed), /seed failure/);
broken.dispose();
assert.equal(macros.size, 0);

console.log('PASS: 头部噪声纯生成、10–48段、原生宏、固定/每轮随机、请求内一致、辅助请求隔离、异常阻断和卸载。');
