import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const blueprint = read('Doc/世界书设定相关/地球蓝图.md');
const overview = read('世界书/地球/[mvu_plot]地球总览.txt');
const characters = vm.runInNewContext(overview.slice(overview.indexOf('  const characters ='), overview.indexOf('  const countriesData =')) + '\ncharacters;');
const parseRow = line => {
  const fields = []; let field = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { fields.push(field); field = ''; }
    else field += c;
  }
  fields.push(field); return fields;
};
const [header, ...rows] = read('Doc/世界书设定相关/角色蓝图.csv').trimEnd().split('\n').map(parseRow);
const csv = Object.fromEntries(rows.filter(r => r[header.indexOf('世界')] === '地球').map(r => [r[0], Object.fromEntries(header.map((key, i) => [key, r[i]]))]));
const all = [...blueprint.matchAll(/^#### ((?:CN|EU|US|JP|RU|IL|ME|IN|AF)\d\d) ([^\n]+)\n([\s\S]*?)(?=\n### |\n#### |(?![\s\S]))/gm)];
let women = 0, men = 0, checks = 0;
for (const [, id, name, body] of all) {
  const fields = Object.fromEntries([...body.matchAll(/^- ([^：\n]+)：([^\n]+)/gm)].map(m => [m[1], m[2]]));
  const [gender, , rawAge, look] = fields.基础.split('｜');
  const age = parseInt(rawAge);
  if (gender === '女') { assert(age >= 18 && age <= 35, name); women++; }
  else men++;
  assert.equal(characters[name].age, age, name);
  assert.equal(characters[name].appearanceType, look.replace('外观为', ''), name);
  assert.equal(characters[name].moderate, '外貌: ' + fields.外貌 + '\n    着装: ' + fields['着装(外)'], name);
  assert.equal(csv[name].性别, gender, name);
  assert.equal(Number(csv[name].实际年龄), age, name);
  assert.equal(csv[name].外观特征, fields.外貌, name);
  const region = { CN: '中国', EU: '欧盟', US: '英美', JP: '日本', RU: '俄罗斯', IL: '以色列', ME: '中东', IN: '印度', AF: '非洲' }[id.slice(0, 2)];
  const source = read(`世界书/地球/人物/[mvu_plot]人物-地球-${region}.txt`);
  const C = vm.runInNewContext(source.slice(source.indexOf('const C ='), source.indexOf('const outputText =')) + '\nC;');
  for (const mode of ['moderate', 'detail']) {
    assert(C[name][mode].includes(fields.外貌), name + mode);
    assert(C[name][mode].includes(fields['身份与地点']), name + mode);
  }
  checks++;
}
assert.equal(women, 37); assert.equal(men, 12); assert.equal(checks, 49);
assert.equal(csv.明澄.性别, '男');
assert(characters.明澄.title.includes('比丘，'));
assert(!/比丘尼|尼姑/.test(overview));
assert(blueprint.includes('自幼随家族研习道门经典近三十年'));
console.log(`PASS: ${checks} Earth characters consistent across overview, profiles, blueprint and CSV (37 women, 12 men).`);
