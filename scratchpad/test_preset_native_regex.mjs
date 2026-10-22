import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run the installed SillyTavern regex engine. Only browser state, macro expansion,
// and the preset manager are mocked; matching, scopes, depth, and replacement
// use the real implementation. No browser settings or stored messages are changed.
const presetUrl = new URL('../预设/本格修仙/本格修仙-test.json', import.meta.url);
const engineUrl = new URL('../../../../SillyTavern-1.16.0/public/scripts/extensions/regex/engine.js', import.meta.url);
const utilsUrl = new URL('../../../../SillyTavern-1.16.0/public/scripts/utils.js', import.meta.url);
const preset = JSON.parse(fs.readFileSync(presetUrl, 'utf8'));
const regexes = preset.extensions?.regex_scripts;
assert.ok(Array.isArray(regexes) && regexes.length > 0, 'bundle must contain native preset regex_scripts');
assert.ok(!preset.extensions?.SPreset, 'native preset must not need SPreset');
assert.ok(!preset.prompts.some(p => p.identifier === 'regexes-bindings'), 'no legacy regex-binding prompt');

const presetName = '本格修仙preset-test';
let selectedPreset = presetName;
const settings = {
  disabledExtensions: [],
  regex: [],
  character_allowed_regex: [],
  preset_allowed_regex: { openai: [presetName] },
};
const manager = {
  apiId: 'openai',
  getSelectedPresetName: () => selectedPreset,
  readPresetExtensionField: ({ path }) => selectedPreset === presetName ? preset.extensions[path] : undefined,
};
const utils = fs.readFileSync(utilsUrl, 'utf8');
const regexParserStart = utils.indexOf('export function regexFromString(');
const regexParserEnd = utils.indexOf('\nexport class Stopwatch', regexParserStart);
assert.ok(regexParserStart >= 0 && regexParserEnd > regexParserStart, 'find the installed regex parser');
const parserSource = utils.slice(regexParserStart, regexParserEnd).replace(/^export /, '');
const engineSource = fs.readFileSync(engineUrl, 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export /gm, '');
const context = vm.createContext({
  console: { ...console, debug() {} },
  characters: [],
  this_chid: undefined,
  extension_settings: settings,
  getPresetManager: () => manager,
  substituteParams: value => value,
  substituteParamsExtended: value => value,
});
vm.runInContext(`${parserSource}\n${engineSource}\nthis.testEngine = { getRegexedString, RegexProvider };`, context);
const apply = (text, role, mode, depth = 0) => context.testEngine.getRegexedString(
  text,
  role === 'user' ? 1 : 2,
  { isMarkdown: mode === 'display', isPrompt: mode === 'prompt', depth },
);
for (const script of regexes) {
  assert.ok(context.testEngine.RegexProvider.instance.get(script.findRegex), `valid regex: ${script.scriptName}`);
  assert.ok(script.markdownOnly || script.promptOnly, `${script.scriptName} must not rewrite stored messages`);
}

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const body = '<now_plot>\n<gametxt>\n<tp>修仙历12年-3月-4日-午时 @ 凡界-南域-山门 | 晴</tp>\n'
  + 'BODY_SENTINEL\n<!-- LOCAL_CHECK_SENTINEL -->\n<char_info>NPC_SENTINEL</char_info>\n</gametxt>\n'
  + '<summary>SUMMARY_SENTINEL：抵达山门。</summary>\n<options>1. OPTION_SENTINEL</options>\n</now_plot>\n'
  + '<UpdateVariable><Analysis>PATCH_SENTINEL</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>';

for (const tag of ['think', 'thinking', 'recorder_thinking']) {
  const raw = `<${tag}>PLAN_SENTINEL</${tag}>\n${body}`;
  const recent = apply(raw, 'assistant', 'prompt');
  for (const preserved of ['BODY_SENTINEL', 'NPC_SENTINEL', 'SUMMARY_SENTINEL', '<tp>']) {
    check(recent.includes(preserved), `${tag}: recent history preserves ${preserved}`);
  }
  for (const removed of ['PLAN_SENTINEL', 'LOCAL_CHECK_SENTINEL', 'OPTION_SENTINEL', 'PATCH_SENTINEL']) {
    check(!recent.includes(removed), `${tag}: prompt omits ${removed}`);
  }
  check(apply(raw, 'assistant', 'prompt', 5).includes('BODY_SENTINEL'), `${tag}: depth 5 keeps narrative`);
  for (const depth of [6, 20]) {
    const deep = apply(raw, 'assistant', 'prompt', depth);
    check(deep.includes('<summary>SUMMARY_SENTINEL'), `${tag}: depth ${depth} keeps summary tag and text`);
    check(!deep.includes('BODY_SENTINEL'), `${tag}: depth ${depth} replaces narrative`);
    check(!deep.includes('PLAN_SENTINEL'), `${tag}: depth ${depth} omits thought`);
  }
  const noSummary = raw.replace(/<summary>[\s\S]*?<\/summary>/, '');
  check(apply(noSummary, 'assistant', 'prompt', 20).includes('BODY_SENTINEL'), `${tag}: no summary never discards old narrative`);
  const display = apply(raw, 'assistant', 'display');
  check(!display.includes(`<${tag}>`), `${tag}: display converts thought wrapper`);
  check(display.includes('cot-collapse'), `${tag}: display uses existing folded thought panel`);
  for (const preserved of ['BODY_SENTINEL', 'SUMMARY_SENTINEL', 'OPTION_SENTINEL', 'PATCH_SENTINEL']) {
    check(display.includes(preserved), `${tag}: prompt-only cleanup does not alter display ${preserved}`);
  }
  for (const mode of ['prompt', 'display', 'stored']) {
    for (const depth of [0, 6, 20]) {
      check(apply(raw, 'user', mode, depth) === raw, `${tag}: ${mode} preserves user text at depth ${depth}`);
    }
  }
  check(apply(raw, 'assistant', 'stored') === raw, `${tag}: stored assistant message remains intact`);
}

// Disabled/untrusted/other presets must not inherit these transformations.
settings.preset_allowed_regex.openai = [];
check(apply(body, 'assistant', 'prompt') === body, 'native regex requires user authorization');
settings.preset_allowed_regex.openai = [presetName];
selectedPreset = 'other-preset';
check(apply(body, 'assistant', 'prompt') === body, 'switching presets disables this preset scope');
selectedPreset = presetName;
settings.disabledExtensions.push('regex');
check(apply(body, 'assistant', 'prompt') === body, 'disabling the regex extension is respected');

console.log(`Native preset regex: ${checks} behavior checks passed with the installed SillyTavern engine.`);
