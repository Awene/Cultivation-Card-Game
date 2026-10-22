import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderPreset, profiles } from '../预设/本格修仙/模拟预设效果.mjs';

const male = '🔥 NSFW模式·男性向(二选一)', female = '🔥 NSFW模式·女性向(二选一)';
const sfw = ['🔥 NSFW模式·防发情', '🔧 NSFW可选·SFW描写'];
const vocabulary = '🔧 NSFW可选·词汇';
const key = '[mvu_plot][NSFW]基础指导';
const config = renderPreset().config;
assert.equal(config.提示词.find(p => p.名称 === male).启用, true);
assert.equal(config.提示词.find(p => p.名称 === female).启用, false);
assert.equal(new Set(config.提示词.map(p => p.名称 ?? p.id)).size, config.提示词.length);
let cases = 0;
for (const profile of profiles) {
  for (const hidden of ['[]', JSON.stringify([key]), 'invalid', 'null', '{}']) {
    const active = hidden !== JSON.stringify([key]);
    for (const toggles of [{}, { [male]: false, [female]: true }, { [male]: false, [female]: false },
      { [vocabulary]: false }, { [sfw[0]]: false }, { [sfw[1]]: false }, { [sfw[0]]: false, [sfw[1]]: false }]) {
      const { entries, vars } = renderPreset({ profile, hidden, toggles });
      const text = name => entries.find(e => e.name === name)?.content.trim() ?? '';
      for (const name of [male, female, sfw[0]]) {
        const enabled = toggles[name] ?? config.提示词.find(p => p.名称 === name).启用;
        assert.equal(Boolean(text(name)), enabled && (sfw.includes(name) ? !active : active), `${profile}/${hidden}/${name}`);
      }
      const all = entries.map(e => e.content).join('\n');
      assert.equal(text(vocabulary), '', 'optional vocabulary only sets a variable');
      assert.equal(text(sfw[1]), '', 'optional SFW prose only sets a variable');
      const enabled = name => toggles[name] ?? config.提示词.find(p => p.名称 === name).启用;
      assert.equal(all.includes('<banned_sex_word>'), active && (enabled(male) || enabled(female)) && enabled(vocabulary));
      assert.equal(all.includes('## SFW 男凝描写'), !active && enabled(sfw[0]) && enabled(sfw[1]));
      assert.ok((all.match(/<NSFW_content>/g) ?? []).length <= 1, 'one active wrapper with either gender selected');
      for (const [name, variable] of [[vocabulary, 'NSFW词汇'], [sfw[1], 'SFW描写']]) {
        assert.equal(Boolean(vars[variable]?.trim()), enabled(name), 'disabled option resets its variable');
        assert.ok(!/<%|NSFW_content/.test(vars[variable] ?? ''), 'stored prose has no nested EJS or wrapper');
      }
      for (const name of [male, female, sfw[0]]) {
        const rendered = text(name);
        assert.equal((rendered.match(/<NSFW_content>/g) ?? []).length, rendered ? 1 : 0);
        assert.equal((rendered.match(/<\/NSFW_content>/g) ?? []).length, rendered ? 1 : 0);
      }
      assert.ok(!/本格NSFW来源|sex_f|sex_c|nsfw_pacing|\{\{|<%/.test(all));
      for (const dead of ['本格NSFW来源', 'sex_f', 'sex_c', 'NSFW内容', 'nsfw词汇']) assert.ok(!(dead in vars));
      cases++;
    }
  }
}

// Exercise disabled optional entries too: EJS is evaluated, not merely parsed.
for (const item of config.提示词.filter(p => p.文件)) {
  const source = fs.readFileSync(new URL(`../预设/本格修仙/${item.文件}.txt`, import.meta.url), 'utf8');
  assert.ok(!/本格NSFW来源|NSFW来源·|getvar::(?:NSFW内容|nsfw词汇|sex_f|sex_c)/.test(source), item.名称);
  for (const profile of profiles) {
    const { entries } = renderPreset({ profile, toggles: { [item.名称]: true } });
    assert.ok(!entries.some(e => /<%|\{\{/.test(e.content)), item.名称);
    cases++;
  }
}
console.log(`NSFW routing and optional-entry EJS: ${cases} configurations passed.`);
