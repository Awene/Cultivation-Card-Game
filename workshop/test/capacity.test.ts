import { describe, expect, it } from 'vitest';
import { ensureUploadCapacity, retentionScore } from '../src/capacity';
import type { Bindings } from '../src/types';

describe('retentionScore', () => {
  it('让刚过保护期的无互动图包比长期无人问津的图包更耐淘汰', () => {
    const fresh = retentionScore({ ageDays: 30, graceDays: 30, likes: 0, downloads: 0 });
    const stale = retentionScore({ ageDays: 365, graceDays: 30, likes: 0, downloads: 0 });
    expect(fresh).toBeGreaterThan(stale);
  });

  it('保留拥有稳定互动的老图包', () => {
    const popularOld = retentionScore({ ageDays: 365, graceDays: 30, likes: 30, downloads: 500 });
    const ignoredFresh = retentionScore({ ageDays: 30, graceDays: 30, likes: 0, downloads: 0 });
    expect(popularOld).toBeGreaterThan(ignoredFresh);
  });

  it('同等条件下点赞比单次下载贡献更高', () => {
    const liked = retentionScore({ ageDays: 100, graceDays: 30, likes: 1, downloads: 0 });
    const downloaded = retentionScore({ ageDays: 100, graceDays: 30, likes: 0, downloads: 1 });
    expect(liked).toBeGreaterThan(downloaded);
  });
});

describe('ensureUploadCapacity', () => {
  it('总容量包含世界书正文与封面', async () => {
    let usageQuery = '';
    const env = {
      DB: {
        prepare(query: string) {
          usageQuery = query;
          return {
            first: async () => ({ bytes: 0 }),
          };
        },
      },
    } as unknown as Bindings;

    await ensureUploadCapacity(env, 1, 'new-worldbook');

    expect(usageQuery).toContain('SUM(byte_size + COALESCE(cover_byte_size, 0))');
    expect(usageQuery).toContain("FROM worldbook_packs WHERE status != 'removed'");
  });
});
