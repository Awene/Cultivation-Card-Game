// 一次性迁移：先将人物成品中的手改正文回收到创作源，再运行人物生成器。
// 只输出 apply_patch；不写盘。
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {read, regions} from './spirit_cast_sources.mjs';
import {patch} from './build_spirit_cast.mjs';

let out = '';
for (const region of regions.filter(r => !process.argv[2] || r === process.argv[2])) {
  const basePath = `scratchpad/cast-${region}.json`;
  const deepPath = `scratchpad/deep-cast-${region}.json`;
  const bases = JSON.parse(read(basePath));
  const deep = JSON.parse(read(deepPath));
  const cache = new Map();
  for (const p of bases) {
    const path = `世界书/灵界/${region}/人物/[mvu_plot]人物-${region}-${p.group}.txt`;
    if (!cache.has(path)) {
      const match = read(path).match(/const C = (\{[\s\S]*?\n\});/);
      assert(match, path);
      cache.set(path, vm.runInNewContext('(' + match[1] + ')', {}, {timeout: 1000}));
    }
    const c = cache.get(path)[p.name];
    assert(c, p.name);
    const d = deep.find(x => x.name === p.name);
    const fields = Object.fromEntries([...c.detail.matchAll(/^([^\n:]+): (.*)$/gm)].map(m => [m[1], m[2]]));
    d.charm = fields['女性魅力'] || fields['男性魅力'] || fields['角色魅力'];
    d.outer = fields['着装(外)'];
    d.inner = fields['着装(内)'];
    d.artifact = fields['法宝'];
    d.core = fields['底色'];
    d.traits = [...c.detail.matchAll(/^\[([^\]\n]+)\]\n([\s\S]*?)(?=\n\n\[|(?![\s\S]))/gm)].map(m => ({
      name: m[1], scenes: m[2].split(/^[①②③] /m).slice(1).map(s => s.trim()),
    }));
    d.confession = c.表白.replace(/^\[表白\]\n/, '');
    d.partner = c.道侣.replace(/^\[道侣相处\]\n/, '').split(/^[①②③④] /m).slice(1).map(s => s.trim());
    assert(d.charm && d.outer && d.inner && d.artifact && d.core, p.name + '正文头');
    assert(d.traits.length === 2 && d.traits.every(t => t.scenes.length === 3), p.name + '性格情境');
    assert(d.partner.length === 4, p.name + '道侣情境');
    if (c.kws.length !== 1 || c.kws[0] !== p.name) p.kws = [...c.kws];
    if (c.locationKws?.length) p.locationKws = [...c.locationKws];
    if (c.moderate) p.moderate = c.moderate;
  }
  if (JSON.stringify(bases) !== JSON.stringify(JSON.parse(read(basePath))))
    out += patch(basePath, JSON.stringify(bases, null, 2) + '\n');
  if (JSON.stringify(deep) !== JSON.stringify(JSON.parse(read(deepPath))))
    out += patch(deepPath, JSON.stringify(deep, null, 2) + '\n');
}
process.stdout.write('*** Begin Patch\n' + out + '*** End Patch\n');
