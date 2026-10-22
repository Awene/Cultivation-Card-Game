import assert from 'node:assert/strict';
import fs from 'node:fs';
import { expandPresetMacros, renderPreset, profiles } from '../预设/本格修仙/模拟预设效果.mjs';

// Reproduce the exact legacy-engine failure seen in the user's processed prompt.
const oldVars = {};
const brokenActor = expandPresetMacros('{{setvar::抢话::<actor_control target="{{user}}" mode="reserved">正文</actor_control>}}', oldVars, 'Aw');
assert.equal(oldVars.抢话, '<actor_control target="{{user');
assert.equal(brokenActor, '" mode="reserved">正文</actor_control>}}');
assert.equal(expandPresetMacros('{{setvar::用户设定::{{//填写设定}}}}', oldVars, 'Aw'), '}}');
assert.equal(oldVars.用户设定, '{{//填写设定');

const root = new URL('../预设/本格修仙/', import.meta.url);
const read = name => fs.readFileSync(new URL(`条目/${name}.txt`, root), 'utf8');
const stale = { SFW描写: 'stale', NSFW词汇: 'stale', 推进规划: 'stale', 用户设定: 'stale' };
expandPresetMacros(read('📚 宏与变量'), stale, 'Aw');
for (const key of Object.keys(stale)) assert.equal(stale[key], '', `reset ${key}`);
assert.equal(expandPresetMacros(read('⚙️ 用户附加设定'), stale, 'Aw').trim(), '');
assert.equal(stale.用户设定, '');

let cases = 0;
for (const profile of profiles) {
  for (const delegated of [false, true]) {
    for (const outline of [false, true]) {
      const { entries, vars } = renderPreset({ profile, user: 'Aw', toggles: {
        '⚙️ 允许抢话': delegated, '⚙️ 禁止抢话': !delegated, '🧭 大纲展开': outline,
      } });
      const all = entries.map(e => e.content).join('\n');
      assert.ok(!/{{|}}|<%|PACE=;/.test(all), 'no macro debris or empty pace field');
      for (const name of ['⚙️ 允许抢话', '⚙️ 禁止抢话', '⚙️ 用户附加设定']) {
        assert.equal(entries.find(e => e.name === name)?.content.trim() ?? '', '', 'setters never leak prose');
      }
      const settings = all.match(/<gametxt_setting>([\s\S]*?)<\/gametxt_setting>/)?.[1];
      assert.ok(settings);
      assert.equal((all.match(/<actor_control /g) ?? []).length, 1);
      assert.ok(settings.includes(`<actor_control target="Aw" mode="${delegated ? 'delegated' : 'reserved'}">`));
      assert.ok(settings.includes('</actor_control>'));
      assert.equal(all.includes('PACE='), outline);
      assert.equal(all.includes('不使用破折号；'), profile === 'Claude');
      assert.equal(vars.用户设定, '');
      cases++;
    }
  }
}
console.log(`Legacy macro ordering: reproduced both reported failures; ${cases} fixed configurations passed.`);
