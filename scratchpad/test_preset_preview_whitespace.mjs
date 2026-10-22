import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import { renderPreset, assemblePreview } from '../预设/本格修仙/模拟预设效果.mjs';
import { compactFinalizedMessages, installMessageProcessing } from '../预设/本格修仙/脚本/消息分区.js';

const template = {};
runInNewContext(fs.readFileSync(new URL('../../../../SillyTavern-1.16.0/data/default-user/extensions/ST-Prompt-Template/src/3rdparty/ejs.js', import.meta.url), 'utf8'), template);
const handlers = new Map();
const off = (event, fn) => handlers.set(event, (handlers.get(event) ?? []).filter(f => f !== fn));
const on = (event, fn) => handlers.set(event, [...(handlers.get(event) ?? []), fn]);
const last = (event, fn) => { off(event, fn); on(event, fn); };
const emit = async (event, ...args) => { for (const fn of [...(handlers.get(event) ?? [])]) await fn(...args); };
const events = Object.fromEntries(['GENERATE_AFTER_DATA', 'CHAT_COMPLETION_SETTINGS_READY', 'GENERATION_AFTER_COMMANDS', 'OAI_PRESET_CHANGED_AFTER'].map(s => [s, s]));
const installed = installMessageProcessing({ on, off, last, events });
// Simulate the template extension loading after the preset script.
on(events.CHAT_COMPLETION_SETTINGS_READY, data => {
  data.messages = data.messages.map(m => ({ ...m, content: template.ejs.render(m.content) }));
});
const messages = assemblePreview(renderPreset().entries);
const body = messages.find(m => m.content.includes('<output_contract>'));
body.content = body.content.replace('<world_context>', '<world_context>\n' + '<% if (false) { %>hidden<% } %>\n'.repeat(8));
body.content = body.content.replace('<historical_record>', '<historical_record>\n保留历史\n\n\n原样');
await emit(events.GENERATION_AFTER_COMMANDS);
const preview = { prompt: messages };
await emit(events.GENERATE_AFTER_DATA, preview, true);
assert.ok(preview.prompt.some(m => m.content.includes('<%')));
const request = { messages: structuredClone(preview.prompt) };
await emit(events.CHAT_COMPLETION_SETTINGS_READY, request);
const final = request.messages.find(m => m.content.includes('<output_contract>')).content;
assert.ok(!/<%|\n(?:[ \t]*\n){2,}/.test(final.split('<historical_record>')[0]));
assert.ok(final.includes('保留历史\n\n\n原样'));
assert.deepEqual(compactFinalizedMessages(request.messages), request.messages, 'cleanup is idempotent');
assert.equal(compactFinalizedMessages([{ role: 'user', content: '辅助请求\n\n\n保留' }]), null);
installed.dispose();

// The supplied processed example is evidence, never overwrite it.
const sample = fs.readFileSync(new URL('../Doc/生成结果示例.txt', import.meta.url), 'utf8');
const cleaned = compactFinalizedMessages([{ role: 'user', content: sample }])[0].content;
const outsideHistory = cleaned.replace(/<historical_record>[\s\S]*?<\/historical_record>/, '');
assert.ok(!/\n(?:[ \t]*\n){2,}/.test(outsideHistory));
assert.equal(cleaned.replace(/\s/g, ''), sample.replace(/\s/g, ''), 'no non-whitespace content changes');
console.log('PASS: preview-before-EJS cleanup, late extension loading, original history, auxiliary isolation, and current user sample.');
