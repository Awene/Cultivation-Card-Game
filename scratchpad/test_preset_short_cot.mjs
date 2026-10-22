import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderPreset, assemblePreview } from '../预设/本格修仙/模拟预设效果.mjs';

// Protocol regression, not a claim about live model behavior. The preview uses
// macro expansion followed by EJS and the bundled message partition function.
const root = new URL('../预设/本格修仙/', import.meta.url);
const profiles = ['Gemini', 'Claude', 'Glm', 'DeepSeek'];
const config = renderPreset().config;
const prompts = config.提示词;
const headers = prompts.filter(p => /^🔌 (Gemini|Claude|Glm|DeepSeek)头部$/.test(p.名称 || ''));
assert.equal(headers.length, profiles.length);
assert.deepEqual(headers.filter(p => p.启用).map(p => p.名称), ['🔌 Gemini头部']);
assert.ok(!prompts.some(p => (p.名称 || '').startsWith('✨')), 'remove Prime visual extras');
assert.ok(prompts.findIndex(p => p.名称 === '⚙️语言字数设置') < prompts.findIndex(p => p.名称 === '📚 宏与变量'));
for (const name of ['🧭变量主API(二选一)', '🧭变量额外API(二选一)']) {
  assert.equal(prompts.filter(p => p.名称 === name).length, 1, `keep the front-end API-mode key: ${name}`);
}

let files = 0;
function checkLinkedFiles(node) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.文件 === 'string') {
    const relative = node.文件.replaceAll('\\', '/');
    assert.ok(['', '.txt', '.yaml', '.yml', '.js', '.mjs', '.md'].some(ext => fs.existsSync(new URL(relative + ext, root))), `linked file exists: ${relative}`);
    files++;
  }
  for (const value of Object.values(node)) checkLinkedFiles(value);
}
checkLinkedFiles(config);

const routes = [
  { label: 'daily', route: '[]', hidden: '[]', advance: false },
  { label: 'advance', route: '["[时间推进规则]"]', hidden: '[]', advance: true },
  { label: 'invalid route', route: 'invalid-json', hidden: '[]', advance: false },
  { label: 'null route', route: 'null', hidden: '[]', advance: false },
  { label: 'hidden rules', route: '[]', hidden: '["[战斗规则]","[轮回转生规则]"]', advance: false },
  { label: 'advance + hidden', route: '["[时间推进规则]"]', hidden: '["[战斗规则]"]', advance: true },
  { label: 'invalid hidden', route: '[]', hidden: 'invalid-json', advance: false },
  { label: 'null hidden', route: '[]', hidden: 'null', advance: false },
];
let cases = 0;
const count = (text, literal) => text.split(literal).length - 1;
const content = entries => entries.map(entry => entry.content || '').join('\n');
function block(text, name) {
  const match = text.match(new RegExp(`^<${name}>[ \\t]*\\r?\\n([\\s\\S]*?)^<\\/${name}>`, 'm'));
  assert.ok(match, `missing ${name}`);
  return match[1];
}
function textOfMessages(messages) {
  return messages.map(message => typeof message.content === 'string'
    ? message.content
    : message.content.filter(part => part.type === 'text').map(part => part.text).join('\n')).join('\n');
}

for (const profile of profiles) {
  for (const mode of ['main', 'extra']) {
    for (const nsfw of [false, true]) {
      for (const scenario of routes) {
        const label = `${profile}/${mode}/${nsfw}/${scenario.label}`;
        const { vars, entries } = renderPreset({ profile, mode, route: scenario.route, hidden: nsfw ? scenario.hidden : JSON.stringify(['[mvu_plot][NSFW]基础指导']), user: '测试玩家' });
        const all = content(entries);
        assert.equal(vars.ai模型, profile, label);
        assert.equal(vars.变量模式, mode, label);
        assert.ok(!/\{\{|<%|\bundefined\b|ReferenceError|缺失外链文件/.test(all), `${label}: no unexpanded macros or EJS failures`);
        assert.equal([...all.matchAll(/^<recorder_audit_format>\s*$/gm)].length, 1, `${label}: one active checklist`);
        assert.equal([...all.matchAll(/^<\/recorder_audit_format>\s*$/gm)].length, 1, label);
        const audit = block(all, 'recorder_audit_format');
        assert.equal(audit.includes('MODE=WORLD_ADVANCE'), scenario.advance, label);
        assert.equal(audit.includes('MODE=STORY'), !scenario.advance, label);
        const steps = [...audit.matchAll(/^([1-7])\.\s+[^\n]+:/gm)].map(match => Number(match[1]));
        assert.deepEqual(steps, scenario.advance ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 7], label);
        assert.equal(audit.includes('LANGUAGE=English'), profile === 'Claude', label);
        assert.equal(audit.includes('LANGUAGE=中文'), profile !== 'Claude', label);
        assert.ok(!/输入裁决|场景人物|规则触发|群像编排/.test(profile === 'Claude' ? audit : ''), `${label}: Claude uses English step instructions`);
        if (scenario.advance) {
          assert.ok(/time_info/.test(audit), `${label}: per-person advancement panels`);
          assert.ok(/RUMORS=/.test(audit), `${label}: refresh rumors`);
          assert.ok(/其它地区|other regions|other places|other.*events/i.test(audit), `${label}: independent rumor leads`);
        }
        const ruleIndex = audit.split('RULE_INDEX:')[1];
        assert.ok(ruleIndex, `${label}: rule index available`);
        let hidden;
        try { hidden = JSON.parse(scenario.hidden); } catch { hidden = []; }
        if (!Array.isArray(hidden) || !nsfw) hidden = [];
        for (const rule of ['[战斗规则]', '[轮回转生规则]']) {
          assert.equal(ruleIndex.includes(rule), !scenario.advance && !hidden.includes(rule), `${label}: available rule ${rule}`);
        }

        assert.ok(all.includes(scenario.advance ? '2500-3500字' : '1500-2500字'), `${label}: length switches by route`);
        assert.ok(all.includes('简体中文'), `${label}: body retains configured language`);
        assert.ok(block(all, 'output_contract').includes(mode === 'main' ? '本轮须更新变量' : '本轮不更新变量'), `${label}: early protocol resolves the selected mode`);
        const template = block(all, 'output_template');
        for (const tag of ['now_plot', 'gametxt', 'tp', 'summary', 'options']) {
          assert.equal(count(template, `<${tag}>`), 1, `${label}: one ${tag} template`);
          assert.equal(count(template, `</${tag}>`), 1, `${label}: closed ${tag} template`);
        }
        assert.equal(template.includes('<UpdateVariable>'), mode === 'main', `${label}: variable output follows mode`);
        if (mode === 'main') {
          assert.ok(template.indexOf('<UpdateVariable>') > template.indexOf('</now_plot>'), `${label}: variable block follows narrative`);
          assert.ok(/actual changes|真实发生/.test(audit), `${label}: main API handles real changes`);
        } else {
          assert.ok(/Do not update variables|本轮不更新变量/.test(audit), `${label}: narrative does not update variables`);
          assert.ok(/naturally|自然呈现/.test(audit), `${label}: extra-mode narrative uses state naturally`);
        }
        assert.ok(!/系统核心|价格矩阵参考|当地货币名|东方元素统一西幻化|面板自由描述同样西幻化/.test(all), `${label}: no reference-card mechanics or forced fantasy conversion`);

        const messages = assemblePreview(entries);
        assert.ok(Array.isArray(messages) && messages.length > 0, `${label}: assembled messages`);
        assert.equal(messages.at(-1).role, 'user', `${label}: request ends in user role`);
        assert.ok(!/<\|本格_[^>]+\|>|<%|\{\{|ReferenceError/.test(textOfMessages(messages)), `${label}: no unresolved transport slots`);
        cases++;
      }
    }
  }
}

// Optional footer modules must not leave stale macro values in later requests.
for (const profile of profiles) {
  for (const summary of [false, true]) {
    for (const options of [false, true]) {
      const { entries } = renderPreset({ profile, mode: 'extra', summary, options });
      const template = block(content(entries), 'output_template');
      assert.equal(template.includes('<summary>'), summary, `${profile}: summary toggle`);
      assert.equal(template.includes('<options>'), options, `${profile}: options toggle`);
      cases++;
    }
  }
}

console.log(`Prime-structure preset: ${cases} rendered configurations and ${files} linked files passed.`);
