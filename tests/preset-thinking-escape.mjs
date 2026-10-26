import fs from 'node:fs';
import assert from 'node:assert/strict';

const preset = JSON.parse(fs.readFileSync(new URL('../发布文件/Ver.1.1/本格修仙preset-Ver.1.1.json', import.meta.url), 'utf8'));
const rules = preset.extensions.regex_scripts;
const escape = rules.findIndex(r => r.scriptName === '思维链引用标签转义');
const display = rules.findIndex(r => r.scriptName === '思维链展示');
assert.ok(escape >= 0 && escape < display);
const regex = r => {
  const end = r.findRegex.lastIndexOf('/');
  return new RegExp(r.findRegex.slice(1, end), r.findRegex.slice(end + 1));
};
for (const tag of ['thinking', 'think', 'recorder_thinking']) {
  for (const newline of ['\n', '\r\n']) {
    const tail = '<now_plot>正文</now_plot>' + newline + '<UpdateVariable>变量</UpdateVariable>';
    const input = [`<${tag}>`, '`</' + tag + '>` → `<now_plot>` → `</now_plot>`', '字数控制1800', `</${tag}>`, tail].join(newline);
    const clean = input.replace(regex(rules[escape]), rules[escape].replaceString);
    const matches = [...clean.matchAll(regex(rules[display]))];
    assert.equal(matches.length, 1);
    assert.ok(matches[0][1].includes('字数控制1800'));
    assert.equal([...clean.matchAll(/<now_plot>([\s\S]*?)<\/now_plot>/gi)].length, 1);
    assert.equal(clean.slice(clean.indexOf('<now_plot>')), tail);
  }
}
console.log('PASS: thinking/think/recorder_thinking, LF/CRLF, quoted tags and unchanged body/variables');
