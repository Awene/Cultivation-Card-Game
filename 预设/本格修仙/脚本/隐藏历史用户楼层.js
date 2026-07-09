/**
 * 隐藏历史用户楼层
 * ------------------------------------------------------------------
 * 目的: 让主 AI 只看到「AI 回复 + 当前这条用户指令」, 看不到过去的用户指令,
 *      且被隐藏的楼层在聊天里显示成 👻(和手动点隐藏、以及【总结】脚本一致)。
 *
 * 机制(踩过的坑记录在此):
 *   - 隐藏 = 设 is_hidden(酒馆助手内部映射到 ST 的 is_system), 该楼即从 coreChat
 *     中排除, 不进入发给 AI 的 prompt。
 *   - 但「显示成 👻」必须用 setChatMessages 的 refresh:'all'(整章重载才会重渲染隐藏态);
 *     refresh:'affected'/'none' 只更新正文块, 不会画出 👻。这点和【总结】脚本同款。
 *
 * 两个钩子:
 *   1) GENERATION_AFTER_COMMANDS(生成前, 会被 await): 只改数据(refresh:'none'),
 *      确保「本次」生成的 prompt 就已排除历史 user 楼 —— 不泄漏上一条指令。
 *   2) MESSAGE_RECEIVED(回复后): 用 refresh:'all' 整章重载一次, 把被隐藏的
 *      user 楼画成 👻。仅在「这一轮确有新楼被隐藏」时才重载, 不会空转。
 *
 * 深度语义: 永远保留楼层号最大的 KEEP_RECENT_USER 条 user 楼可见(=当前指令;
 *   重新生成/swipe 时也是触发该回复的那条), 其余历史 user 楼一律隐藏。
 *
 * 与【本格修仙】总结脚本不冲突: 本脚本只动 user 楼且恒留最新一条; 总结脚本只在
 *   真正生成总结时改「已被总结覆盖」的楼, 作用域不重叠; 总结读聊天用 hide_state:'all',
 *   被隐藏的 user 楼它照样读得到, 总结内容不受影响。
 */

// —— 配置 —— //
const ENABLED = true; // 总开关
const KEEP_RECENT_USER = 1; // 保留最新的几条 user 楼可见(默认 1 = 只留当前指令)
const CHUNK = 50; // setChatMessages 分块大小

// 计算「应隐藏/应取消隐藏」的 user 楼改动列表
function computeUserFloorPlan() {
  const lastId = getLastMessageId();
  if (lastId < 0) return { users: [], keep: new Set(), updates: [] };
  const users = getChatMessages(`0-${lastId}`, {
    role: 'user',
    hide_state: 'all',
    include_swipes: false,
  }) || [];
  const ids = users.map(m => m.message_id).filter(Number.isFinite).sort((a, b) => a - b);
  // 楼层号最大的 KEEP_RECENT_USER 条保留可见; user 楼数量不足则全部保留
  const keep = new Set(ids.slice(-KEEP_RECENT_USER));
  const updates = [];
  for (const m of users) {
    const id = m.message_id;
    if (!Number.isFinite(id)) continue;
    const shouldHide = !keep.has(id);
    if (!!m.is_hidden !== shouldHide) updates.push({ message_id: id, is_hidden: shouldHide });
  }
  return { users, keep, updates };
}

// 分块写入; 最后一块用指定 refresh(整章 'all' 才会画 👻)
async function applyUpdates(updates, finalRefresh) {
  for (let i = 0; i < updates.length; i += CHUNK) {
    const isLast = i + CHUNK >= updates.length;
    await setChatMessages(updates.slice(i, i + CHUNK), { refresh: isLast ? finalRefresh : 'none' });
  }
}

let _needDisplaySync = false;

// 1) 生成前: 只改数据(不重渲染, 避免打断生成), 保证本次 prompt 无历史 user 楼
eventOn(tavern_events.GENERATION_AFTER_COMMANDS, async (_type, _option, dry_run) => {
  if (!ENABLED || dry_run) return;
  try {
    const { updates } = computeUserFloorPlan();
    if (updates.length) {
      await applyUpdates(updates, 'none');
      _needDisplaySync = true; // 数据已改但没画 👻, 交给回复后整章重载
    }
  } catch (e) {
    console.error('[隐藏历史用户楼层] 生成前处理失败:', e);
  }
});

// 2) 回复后: 用 refresh:'all' 整章重载, 把被隐藏的 user 楼画成 👻
eventOn(tavern_events.MESSAGE_RECEIVED, async () => {
  if (!ENABLED) return;
  try {
    const { users, keep, updates } = computeUserFloorPlan();
    if (updates.length) {
      // 仍有未处理的改动(如生成前钩子没赶上) → 直接带 refresh:'all'
      await applyUpdates(updates, 'all');
      _needDisplaySync = false;
    } else if (_needDisplaySync) {
      // 数据已由生成前钩子改好但显示还没画 👻 → 强制整章重载一次
      _needDisplaySync = false;
      const hidden = users.filter(m => !keep.has(m.message_id))
        .map(m => ({ message_id: m.message_id, is_hidden: true }));
      if (hidden.length) await applyUpdates(hidden, 'all');
    }
  } catch (e) {
    console.error('[隐藏历史用户楼层] 显示同步失败:', e);
  }
});

console.log('[隐藏历史用户楼层] 已加载 (保留最新', KEEP_RECENT_USER, '条 user 楼可见)');
