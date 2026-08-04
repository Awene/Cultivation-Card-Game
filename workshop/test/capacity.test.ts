import { describe, expect, it } from 'vitest';
import { retentionScore } from '../src/capacity';

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
