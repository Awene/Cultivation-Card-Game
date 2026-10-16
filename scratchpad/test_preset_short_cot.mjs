import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../tavern_helper_template-main/package.json', import.meta.url));
const YAML = require('yaml');
const root = new URL('../预设/本格修仙/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const config = YAML.parse(read('index.yaml'));
assert.ok(config.提示词.findIndex(p => p.名称 === '⚙️语言字数设置') < config.提示词.findIndex(p => p.名称 === '🛑初始化'));
assert.ok(!read('条目/🛑初始化.txt').includes('{{setvar::字数::'), '初始化不得清空前置的语言字数设置');

// Evaluate the plain EJS control/interpolation blocks used by this preset only.
// This does not emulate ST's request pipeline, macro engine, or remote models.
function render(source, values) {
  let code = 'let out = "";\n', cursor = 0;
  for (const match of source.matchAll(/<%([_=\-]?)([\s\S]*?)(?:[_\-])?%>/g)) {
    code += 'out += ' + JSON.stringify(source.slice(cursor, match.index)) + ';\n';
    code += ['=', '-'].includes(match[1]) ? 'out += (' + match[2] + ');\n' : match[2] + '\n';
    cursor = match.index + match[0].length;
  }
  code += 'out += ' + JSON.stringify(source.slice(cursor)) + '; return out;';
  return new Function(...Object.keys(values), code)(...Object.values(values));
}

function macros(text, vars) {
  return text.replace(/\{\{setvar::([^:]+)::([\s\S]*?)\}\}/g, (_, key, value) => {
    vars[key] = value;
    return '';
  });
}

for (const item of config.提示词) {
  if (!item.文件) continue;
  const base = item.文件.replaceAll('\\', '/');
  assert.ok(['', '.txt', '.yaml', '.ejs'].some(ext => fs.existsSync(new URL(base + ext, root))), base);
}
const profiles = config.提示词.filter(p => /^⚓️(?:Gemini|Claude|DS)开$/.test(p.名称));
assert.equal(profiles.length, 3);
assert.deepEqual(profiles.filter(p => p.启用).map(p => p.名称), ['⚓️Gemini开']);
assert.ok(!config.提示词.some(p => /Gemini3/.test(p.名称)));
assert.equal(profiles.find(p => p.名称 === '⚓️Gemini开').角色, '用户');

const source = read('条目/🌐COT.txt');
const hiddenCases = ['[]', '["[轮回转生规则]","[战斗规则]"]', 'invalid-json'];
let count = 0;
for (const profile of profiles) {
  for (const mode of ['主API', '额外API']) {
    for (const hidden of hiddenCases) {
      const vars = {};
      macros(read('条目/🛑初始化.txt'), vars);
      macros(config.提示词.find(p => p.名称 === '🧭转述融入').内容, vars);
      for (const name of ['🧭防全知.txt', '🔥NSFW指导.txt', `🧭变量${mode}(二选一).txt`]) {
        macros(read('条目/' + name), vars);
      }
      macros(read(profile.文件.replaceAll('\\', '/') + '.txt'), vars);
      vars.路由隐藏规则 = hidden;
      const result = render(source, { getvar: key => vars[key] ?? '' });
      assert.deepEqual([...result.matchAll(/^Step (\d+):/gm)].map(m => Number(m[1])), [1, 2, 3, 4, 5, 6, 7]);
      assert.ok(!/<%|{{|undefined/.test(result));
      const english = vars.ai模型 === 'Claude';
      assert.equal(result.includes('Planning language: English'), english);
      assert.equal(result.includes('思维链语言: 中文'), !english);
      assert.ok(result.includes(vars.cot头) && result.includes(vars.cot尾));
      const absent = hidden.includes('[轮回转生规则]');
      assert.equal(result.includes(english ? 'Reincarnation:' : '轮回转生='), !absent);
      assert.equal(result.includes(english ? 'Combat:' : '战斗='), !absent);
      assert.ok(result.includes(english ? 'World evolution:' : '仅玩家明确要求时回顾'));
      assert.ok(result.includes(english ? 'Task issuance:' : '任务发布='));
      if (english) {
        assert.ok(result.includes('Input delivery:') && result.includes('Character correction:'));
        assert.ok(result.includes(mode === '主API' ? 'record all actual changes' : 'an external model handles'));
        assert.ok(!/进行以下思考|思维链预算|性场景检查|变量处理:/.test(result));
      } else {
        assert.ok(result.includes(mode === '主API' ? '完整记录本轮实际变化' : '由外部模型负责'));
      }
      // Disabling optional settings must not leave stale instructions in the COT.
      for (const key of ['转述1f', '转述1c', '防全知f', '防全知c', 'sex_f', 'sex_c']) vars[key] = '';
      const withoutOptions = render(source, { getvar: key => vars[key] ?? '' });
      assert.ok(!/Input delivery:|Intimate-scene check:|性场景检查:/.test(withoutOptions));
      assert.ok(withoutOptions.includes(english ? 'Character correction:' : '人物修正:'));
      count++;
    }
  }
}
console.log(`PASS: YAML references, model profiles, ${count} model/mode/routing combinations and optional-hook removal.`);

// World advancement must replace, rather than append to, the ordinary plan.
let advancementCount = 0;
for (const profile of profiles) {
  for (const mode of ['主API', '额外API']) {
    const vars = {};
    macros(read('条目/🛑初始化.txt'), vars);
    macros(read(`条目/🧭变量${mode}(二选一).txt`), vars);
    macros(read(profile.文件.replaceAll('\\', '/') + '.txt'), vars);
    const english = vars.ai模型 === 'Claude';
    const changeText = english ? 'List only changes that actually occur' : '只列本轮真实发生';
    const narrativeText = english ? 'Convey them naturally' : '以动作、对白和感受自然呈现';
    for (const active of ['[]', 'invalid-json', '["[时间推进规则]"]']) {
      vars.路由激活规则 = active;
      const result = render(source, { getvar: key => vars[key] ?? '' });
      const world = active.includes('[时间推进规则]');
      assert.deepEqual([...result.matchAll(/^Step (\d+):/gm)].map(m => Number(m[1])), world ? [1,2,3,4,5] : [1,2,3,4,5,6,7]);
      assert.equal(result.includes(changeText), mode === '主API');
      assert.equal(result.includes(narrativeText), mode === '额外API');
      assert.ok(!/<%|{{|undefined/.test(result));
      assert.ok(result.includes(english ? 'Character correction:' : '人物修正:'));
      if (world) {
        assert.ok(!/分析输入与合理性核验|Input analysis and plausibility|连续性检查|Continuity check|2至4|two to four/.test(result));
        assert.ok(result.includes(english ? 'excluding puppets and spirit beasts' : '傀儡、灵兽除外'));
        assert.ok(result.includes(english ? 'without acting for them' : '不代其行动'));
      }
      advancementCount++;
    }
  }
}
assert.ok(!/setvar::(?:身份[fgc]|回顾[fgc]|标签)::/.test(read('条目/🛑初始化.txt')));
assert.ok(!/getvar\(['"](?:身份[fgc]|回顾[fgc])/.test(source));
assert.ok(!read('条目/⚙️SETTING.txt').includes('{{getvar::标签}}'));
assert.ok(!read('条目/⚓️Gemini开.txt').includes('Step 1至Step 7'));
console.log(`PASS: ${advancementCount} ordinary/world-advance/malformed-route cases, variable-mode isolation and fixed-text inlining.`);

// Only bundled prompt entries count; archived unused entries are not loaded.
const bundledSources = config.提示词.map(item => item.文件
  ? read(['', '.txt', '.yaml', '.ejs'].map(ext => item.文件.replaceAll('\\', '/') + ext).find(name => fs.existsSync(new URL(name, root))))
  : (item.内容 ?? '')).join('\n');
const assigned = new Set([...bundledSources.matchAll(/\{\{setvar::([^:}]+)::/g)].map(m => m[1]));
const referenced = new Set([
  ...[...bundledSources.matchAll(/\{\{getvar::([^}]+)\}\}/g)].map(m => m[1]),
  ...[...bundledSources.matchAll(/getvar\(['"]([^'"]+)['"]\)/g)].map(m => m[1]),
]);
assert.deepEqual([...assigned].filter(key => !referenced.has(key)), []);
assert.ok(source.includes('更新传闻：保留有效消息'));
assert.ok(source.includes('largely independent of the current story'));
console.log('PASS: no unread assigned variables in bundled prompts; bilingual rumor update instructions present.');
