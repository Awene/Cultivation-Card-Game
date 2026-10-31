// 门内正文统一取自已确认的整理文档；生成器不再自行拼接书目或取用说明。
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export const draftPath = 'Doc/门内视角整理与创作稿.md';
export const tiers = ['外门', '内门', '管事', '长老'];
const doc = readFileSync(draftPath, 'utf8').replace(/\r\n/g, '\n');
const identityTiers = {
  F04: { 长老: ['城主', '长老', '供奉'], 管事: ['管事', '坊主', '执事'], 内门: ['内门', '匠师', '骨干'] },
  F05: { 长老: ['观主', '长老', '供奉'], 管事: ['管事', '执事'], 内门: ['内门', '亲传'] },
  F06: { 长老: ['社主', '长老', '四大镜师'], 管事: ['管事', '执事', '镜室主持'], 内门: ['内门', '镜师'] },
  F26: { 长老: ['宫主', '长老', '院长', '资深讲席'], 管事: ['管事', '教习', '院务'], 内门: ['内门', '专修', '进修'] },
  F27: { 长老: ['总管', '典狱长', '供奉', '长老'], 管事: ['管事', '统领', '队长', '执事', '卷宗阁文书'], 内门: ['内门', '骨干', '捕头', '缉魔使'] },
  L19: { 长老: ['院正', '资深教习'], 管事: ['教习', '访乡员', '照料员'], 内门: ['熟习学员', '进修学员'] },
};

export const sectInternals = [...doc.matchAll(/#### ([FL]\d+) · ([^\n]+)\n([\s\S]*?)(?=<a id=|## 回填|$)/g)].map(([, id, name, body]) => {
  const source = body.match(/来源：\[[^\]]+\]\(<([^>]+)#L\d+>\)/);
  assert(source, id + ' 缺少来源');
  const file = resolve('Doc', source[1]);
  const region = source[1].split('/').at(-2);
  const world = id.startsWith('F') ? '凡界' : '灵界';
  const blocks = [...body.matchAll(/```text\n([\s\S]*?)\n```/g)].map(m => m[1]);
  assert.equal(blocks.length, 4, id + ' 四档正文');
  for (const block of blocks) {
    assert(block.startsWith('[门内视角]\n'), id + ' 正文起始');
    assert(!/^- (功法书|技艺书|取用|传承方向)[:：]/m.test(block), id + ' 残留旧字段');
  }
  const keywordLine = body.match(/^身份关键词：([^\n]+)/m)?.[1].split('。')[0];
  const kws = [...keywordLine.matchAll(/`([^`]+)`/g)].map(m => m[1]);
  assert(kws.length, id + ' 身份关键词');
  return { id, name, file, region, world, kws, inner: Object.fromEntries(tiers.map((tier, i) => [tier, blocks[i]])), identityTiers: identityTiers[id] };
});
assert.equal(sectInternals.length, 70, '门内条目总数');

export function sectInternal(region, name) {
  const item = sectInternals.find(s => s.region === region && s.name === name);
  assert(item, region + '/' + name + ' 缺少已确认门内正文');
  return item;
}

// 内联到每份总览：维持世界书条目自包含，不依赖跨条目函数。
export function internalRuntime(world) {
  const realmTier = world === '灵界'
    ? "L <= 4 ? '外门' : L === 5 ? '内门' : L === 6 ? '管事' : '长老'"
    : "L <= 1 ? '外门' : L === 2 ? '内门' : L === 3 ? '管事' : '长老'";
  return `  const 身份原值 = getMessageVar('stat_data.身份') || [];
  const 身份列表 = Array.isArray(身份原值) ? 身份原值 : [String(身份原值)];
  const 境界 = String(getMessageVar('stat_data.修炼进度.境界') || '凡人').replace('练气', '炼气').replace('炼虚', '返虚');
  const 境界序 = ['凡人', '炼气', '筑基', '金丹', '元婴', '化神', '返虚', '合体', '大乘', '渡劫'];
  const L = Math.max(0, 境界序.findIndex(name => 境界.includes(name)));
  const 门内档 = ${realmTier};
  const 本宗弟子 = kws => 身份列表.some(id => kws.some(kw => id.includes(kw)));
  const 门内选档 = s => {
    if (!s.门内身份档) return 门内档;
    const 本宗身份 = 身份列表.filter(id => s.门内kws.some(kw => id.includes(kw)))
      .map(id => s.门内kws.reduce((text, kw) => text.replaceAll(kw, ''), id));
    return Object.entries(s.门内身份档).find(([, words]) => 本宗身份.some(id => words.some(word => id.includes(word))))?.[0] || '外门';
  };`;
}
