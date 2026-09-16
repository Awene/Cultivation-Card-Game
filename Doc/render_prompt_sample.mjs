// 自包含 EJS 的轻量采样器：支持本试稿使用的代码、插值、空白裁剪。
// 不模拟酒馆变量/API/include；只运行受信任的本地模板，vm 不是安全沙箱。
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

export function render(source, seed = 1) {
  const math = Object.create(Math);
  let state = seed >>> 0;
  math.random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  let code = 'let out = "";\n';
  let end = 0;
  let trimNext = '';
  for (const match of source.matchAll(/<%([_=#-]?)([\s\S]*?)([_-]?)%>/g)) {
    let literal = source.slice(end, match.index);
    if (trimNext === '_') literal = literal.replace(/^\s+/, '');
    if (trimNext === '-') literal = literal.replace(/^\r?\n/, '');
    if (match[1] === '_') literal = literal.replace(/[ \t]+$/, '');
    code += `out += ${JSON.stringify(literal)};\n`;
    if (match[1] === '=') code += `out += escapeXML(${match[2]});\n`;
    else if (match[1] === '-') code += `out += (${match[2]});\n`;
    else if (match[1] !== '#') code += match[2] + '\n';
    end = match.index + match[0].length;
    trimNext = match[3];
  }
  let tail = source.slice(end);
  if (trimNext === '_') tail = tail.replace(/^\s+/, '');
  if (trimNext === '-') tail = tail.replace(/^\r?\n/, '');
  code += `out += ${JSON.stringify(tail)}; out;`;
  const escapeXML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&#34;', "'":'&#39;'}[c]));
  return new vm.Script(code).runInNewContext({Math: math, escapeXML}, {timeout: 1000});
}

if (process.argv[2] === '--test') {
  assert.equal(render('A<%_ const x = 2; _%>\n<%= x %>'), 'A2');
  assert.equal(render('<%= "<&" %>'), '&lt;&amp;');
  assert.equal(render('<%- "<&" %>'), '<&');
  assert.equal(render('a<%# comment %>b'), 'ab');
  assert.equal(render('<% if (false) { %>x<% } %>'), '');
  assert.equal(render('<%= Math.random() %>', 4), render('<%= Math.random() %>', 4));
  console.log('6 checks passed');
} else if (process.argv[2]) {
  const source = fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const samples = Number(process.argv[3] ?? 20);
  if (!Number.isInteger(samples) || samples < 1) throw new Error('samples must be a positive integer');
  console.log(JSON.stringify(Array.from({length: samples}, (_, i) => render(source, i + 1))));
}
