import { describe, expect, it } from 'vitest';
import { parseDlcEntryName, validateWorldbookPayload } from '../src/worldbook-prefix';

function worldbook(...names: string[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({
    entries: Object.fromEntries(names.map((comment, index) => [String(index), { comment, content: `内容 ${index}` }])),
  }));
}

describe('DLC 世界书条目前缀', () => {
  it('解析命定格式及三类关系', () => {
    expect(parseDlcEntryName('[DLC][扩展][增强战斗][!简化战斗][>基础战斗][<核心规则]规则')).toEqual({
      category: '扩展',
      label: '增强战斗',
      dlcKey: '[DLC][扩展][增强战斗]',
      relations: {
        exclusions: ['简化战斗'],
        replacements: ['基础战斗'],
        prerequisites: ['核心规则'],
      },
    });
  });

  it('接受同一 DLC 分组并汇总关系', () => {
    const result = validateWorldbookPayload(worldbook(
      '[DLC][角色][薇薇拉][<北境]人物设定',
      '[DLC][角色][薇薇拉][>旧薇薇拉]触发逻辑',
    ));
    expect(result).toMatchObject({
      name: '薇薇拉',
      category: '角色',
      dlcKey: '[DLC][角色][薇薇拉]',
      entryCount: 2,
      relations: { prerequisites: ['北境'], replacements: ['旧薇薇拉'] },
    });
  });

  it('拒绝任何未使用 DLC 前缀的条目', () => {
    expect(() => validateWorldbookPayload(worldbook(
      '[DLC][事件][月祭]主条目',
      '没有前缀的附属条目',
    ))).toThrow('不符合 [DLC][类别][名称]');
  });

  it('拒绝在一个包内混用两个 DLC 分组', () => {
    expect(() => validateWorldbookPayload(worldbook(
      '[DLC][角色][甲]设定',
      '[DLC][角色][乙]设定',
    ))).toThrow('只能包含同一组条目');
  });

  it('拒绝不受支持的关系标记', () => {
    expect(() => parseDlcEntryName('[DLC][事件][月祭][?未知]内容')).toThrow('无效的关系标记');
  });
});
