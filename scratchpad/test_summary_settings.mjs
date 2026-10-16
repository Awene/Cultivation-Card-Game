import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../tavern_helper_template-main/package.json', import.meta.url));
const YAML = require('yaml');
const root = new URL('../', import.meta.url);
const source = fs.readFileSync(new URL('脚本/【本格修仙】总结.js', root), 'utf8');
const scriptKey = 'summary_assistant_settings';
const globalKey = 'cultivation_summary_assistant_settings';
const disk = { script: {}, global: {} };
const local = new Map();
let failWrite = false;
function boot() {
  const context = vm.createContext({
    console: { ...console, warn: (...args) => { if (!failWrite) console.warn(...args); } }, setTimeout, clearTimeout,
    SillyTavern: { getCurrentChatId: () => 'test' },
    toastr: { error() {} },
    localStorage: { getItem: k => local.get(k), setItem: (k, v) => local.set(k, v), removeItem: k => local.delete(k) },
    getVariables: ({ type }) => structuredClone(disk[type]),
    insertOrAssignVariables: (value, { type }) => {
      if (failWrite) throw Error('write failed');
      Object.assign(disk[type], structuredClone(value));
    },
  });
  vm.runInContext(source.slice(0, source.indexOf('// 注册脚本按钮')) + `
    globalThis.api = {loadSettings, updateSettings, getSettings, resetSettings, bindSettingsAutoSave,
      migrateOldSettings, DEFAULT_MEGA_SUMMARY_PROMPT_BLOCKS, LEGACY_MEGA_SUMMARY_RULES};
  })();`, context);
  return { api: context.api, context };
}
let { api, context } = boot();
disk.script[scriptKey] = {
  triggerFloorCount: 45, keepFloorCount: 7, customApiKey: 'test-secret',
  megaPromptBlocks: [{ id: 'mega_summary_rules', type: 'prompt', content: api.LEGACY_MEGA_SUMMARY_RULES }],
};
await api.loadSettings();
assert.equal(api.getSettings().triggerFloorCount, 45);
assert.equal(disk.global[globalKey].triggerFloorCount, 45);
assert.equal(disk.global[globalKey].customApiKey, '');
assert.equal(disk.script[scriptKey].customApiKey, '');
const expected = fs.readFileSync(new URL('参考角色卡与预设/大总结提示词 再改我是狗.txt', root), 'utf8')
  .replace(/\r\n/g, '\n').trim().replace('林咏主线', '主角主线');
assert.equal(api.getSettings().megaPromptBlocks.find(b => b.id === 'mega_summary_rules').content, expected);
await api.updateSettings({ triggerFloorCount: 60, keepFloorCount: 12 });
disk.script[scriptKey] = { triggerFloorCount: 15, keepFloorCount: 5 };
({ api, context } = boot());
await api.loadSettings();
assert.equal(api.getSettings().triggerFloorCount, 60, 'Reload/import must retain user preference');
assert.equal(api.getSettings().keepFloorCount, 12);
const custom = api.migrateOldSettings({ megaPromptBlocks: [{ id: 'mega_summary_rules', content: '自定义规则' }] });
assert.equal(custom.megaPromptBlocks[0].content, '自定义规则');
failWrite = true;
await assert.rejects(api.updateSettings({ triggerFloorCount: 90 }), /write failed/);
failWrite = false;

// Exercise delegated input after a dynamic block replacement, without a debounce timer.
const listeners = {};
const status = {};
let triggerValue = '80';
let blockContent = '新板块';
const block = {
  getAttribute: () => 'custom_new',
  querySelector: selector => selector.startsWith('[data-block-content') ? { value: blockContent } : null,
};
let dynamicBlocks = [];
const overlay = {
  querySelector: selector => {
    if (selector === '#sa-save-status') return status;
    if (selector === '#sa-trigger-count') return { value: triggerValue };
    if (selector === '#sa-mega-blocks-container') return { querySelectorAll: () => dynamicBlocks };
    return null;
  },
  addEventListener: (name, handler) => { listeners[name] = handler; },
};
api.bindSettingsAutoSave(overlay);
const input = { id: 'sa-trigger-count', closest: () => true, matches: () => true };
listeners.input({ target: input });
assert.equal(disk.global[globalKey].triggerFloorCount, 80, 'Input must write immediately');
dynamicBlocks = [block];
listeners.input({ target: { ...input, id: 'new-textarea' } });
assert.equal(disk.global[globalKey].megaPromptBlocks[0].content, '新板块');
await overlay._saveSettings();
assert.equal(status.textContent, '已自动保存');
failWrite = true;
await overlay._saveSettings();
assert.match(status.textContent, /保存失败/);
failWrite = false;

const card = YAML.parse(fs.readFileSync(new URL('本格修仙.yaml', root), 'utf8'));
function findRules(value) {
  if (!value || typeof value !== 'object') return;
  if (value.id === 'mega_summary_rules') return value['内容'];
  for (const child of Object.values(value)) { const result = findRules(child); if (result) return result; }
}
assert.equal(findRules(card), expected, 'Bundled card and script defaults must match');
await api.resetSettings();
({ api } = boot());
await api.loadSettings();
assert.equal(api.getSettings().triggerFloorCount, 30);
console.log('Summary settings: migration, reload, immediate/delegated saving, failure reporting and prompt consistency passed.');
