import { describe, expect, it } from 'vitest';
import { isAdminUser } from '../src/db';
import type { Bindings } from '../src/types';

function env(adminList: string): Bindings {
  return { ADMIN_DISCORD_IDS: adminList } as unknown as Bindings;
}

const awene = { id: '808684321153482812', username: 'awene', global_name: 'Awene' };

describe('isAdminUser（管理员权限组）', () => {
  it('按 Discord 数字 ID 匹配', () => {
    expect(isAdminUser(env('808684321153482812'), awene)).toBe(true);
  });

  it('按用户名匹配（大小写不敏感）', () => {
    expect(isAdminUser(env('Awene'), awene)).toBe(true);
    expect(isAdminUser(env('AWENE'), awene)).toBe(true);
  });

  it('按全局显示名匹配', () => {
    expect(isAdminUser(env('Awene'), { ...awene, username: 'completely_different' })).toBe(true);
  });

  it('非管理员返回 false', () => {
    expect(isAdminUser(env('999999'), awene)).toBe(false);
    expect(isAdminUser(env(''), awene)).toBe(false);
  });

  it('支持逗号分隔多值且容忍空白', () => {
    expect(isAdminUser(env('111111,  222222,  808684321153482812'), awene)).toBe(true);
    expect(isAdminUser(env('111111, 222222'), awene)).toBe(false);
  });

  it('空 global_name 不参与匹配（仅靠 global_name 无法命中时返回 false）', () => {
    const row = { ...awene, username: 'different_username', global_name: null };
    expect(isAdminUser(env('Awene'), row)).toBe(false);
    expect(isAdminUser(env('different_username'), row)).toBe(true);
  });
});
