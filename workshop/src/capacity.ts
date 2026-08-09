import { HTTPException } from 'hono/http-exception';
import { nowSeconds, writeAudit } from './db';
import type { Bindings } from './types';

const DEFAULT_SOFT_LIMIT_BYTES = 9_000_000_000;
const DEFAULT_TARGET_BYTES = 8_500_000_000;
const DEFAULT_GRACE_PERIOD_DAYS = 30;
const SECONDS_PER_DAY = 86_400;

interface CapacityCandidate {
  id: string;
  name: string;
  published_at: number;
  like_count: number;
  download_count: number;
  storage_bytes: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function retentionScore(input: { ageDays: number; graceDays: number; likes: number; downloads: number }): number {
  const ageRatio = Math.max(input.ageDays, input.graceDays) / input.graceDays;
  const freshness = 12 / Math.sqrt(ageRatio);
  return 8 * Math.log1p(Math.max(0, input.likes)) + 3 * Math.log1p(Math.max(0, input.downloads)) + freshness;
}

async function permanentlyRemovePack(env: Bindings, pack: CapacityCandidate): Promise<void> {
  const images = await env.DB.prepare("SELECT object_key FROM images WHERE pack_id = ? AND status != 'removed'").bind(pack.id).all<{ object_key: string }>();
  const keys = images.results.map(image => image.object_key);
  for (let offset = 0; offset < keys.length; offset += 1000) {
    await env.IMAGES.delete(keys.slice(offset, offset + 1000));
  }
  const now = nowSeconds();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM pack_likes WHERE pack_id = ?').bind(pack.id),
    env.DB.prepare('DELETE FROM pack_downloads WHERE pack_id = ?').bind(pack.id),
    env.DB.prepare("UPDATE images SET status = 'removed', updated_at = ? WHERE pack_id = ? AND status != 'removed'").bind(now, pack.id),
    env.DB.prepare("UPDATE packs SET status = 'removed', version = version + 1, updated_at = ? WHERE id = ?").bind(now, pack.id),
  ]);
  await writeAudit(env, null, 'pack.capacity_remove', 'pack', pack.id, {
    name: pack.name,
    bytes: pack.storage_bytes,
    likes: pack.like_count,
    downloads: pack.download_count,
  });
}

export async function ensureUploadCapacity(env: Bindings, incomingBytes: number, excludedPackId: string): Promise<void> {
  const softLimit = positiveInteger(env.STORAGE_SOFT_LIMIT_BYTES, DEFAULT_SOFT_LIMIT_BYTES);
  const configuredTarget = positiveInteger(env.STORAGE_TARGET_BYTES, DEFAULT_TARGET_BYTES);
  const target = Math.min(configuredTarget, softLimit);
  const graceDays = positiveInteger(env.PACK_GRACE_PERIOD_DAYS, DEFAULT_GRACE_PERIOD_DAYS);
  const usage = await env.DB.prepare(
    `SELECT
       (SELECT COALESCE(SUM(byte_size), 0) FROM images WHERE status != 'removed') +
       (SELECT COALESCE(SUM(byte_size + COALESCE(cover_byte_size, 0)), 0)
        FROM worldbook_packs WHERE status != 'removed') AS bytes`,
  ).first<{ bytes: number }>();
  const projectedBytes = Number(usage?.bytes ?? 0) + incomingBytes;
  if (projectedBytes <= softLimit) return;

  const now = nowSeconds();
  const cutoff = now - graceDays * SECONDS_PER_DAY;
  const candidates = await env.DB.prepare(
    `SELECT p.id, p.name, p.published_at, p.like_count, p.download_count,
       COALESCE(SUM(i.byte_size), 0) AS storage_bytes
     FROM packs p JOIN images i ON i.pack_id = p.id AND i.status != 'removed'
     WHERE p.status = 'published' AND p.published_at IS NOT NULL AND p.published_at <= ? AND p.id != ?
     GROUP BY p.id`,
  )
    .bind(cutoff, excludedPackId)
    .all<CapacityCandidate>();

  const ranked = candidates.results
    .map(pack => ({
      pack,
      score: retentionScore({
        ageDays: Math.max(1, (now - pack.published_at) / SECONDS_PER_DAY),
        graceDays,
        likes: pack.like_count,
        downloads: pack.download_count,
      }),
    }))
    .sort((left, right) => left.score - right.score || left.pack.published_at - right.pack.published_at);

  let remaining = projectedBytes;
  for (const item of ranked) {
    if (remaining <= target) break;
    await permanentlyRemovePack(env, item.pack);
    remaining -= Number(item.pack.storage_bytes);
  }
  if (remaining > softLimit) {
    // 抛 HTTPException（Error 子类），勿直接 throw Response（见 db.ts 说明）
    throw new HTTPException(507, {
      message: '云端图片容量已接近上限，且暂无超过保护期的低热度公开图包可清理，请稍后再试',
    });
  }
}
