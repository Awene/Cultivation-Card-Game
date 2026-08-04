export type PackCategory = '风景' | '人物' | '其他';
export type ImageRating = 'sfw' | 'nsfw';
export type PackStatus = 'draft' | 'published' | 'hidden' | 'removed';
export type ImageStatus = 'active' | 'hidden' | 'removed';

export interface Bindings {
  DB: D1Database;
  IMAGES: R2Bucket;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ADMIN_DISCORD_IDS: string;
  PUBLIC_BASE_URL: string;
  DISCORD_REDIRECT_URI: string;
  STORAGE_SOFT_LIMIT_BYTES?: string;
  STORAGE_TARGET_BYTES?: string;
  PACK_GRACE_PERIOD_DAYS?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  status: 'active' | 'banned';
  isAdmin: boolean;
}

export interface AppVariables {
  user: AuthUser;
}

export interface ImageInspection {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
  containsPrivateMetadata: boolean;
}

