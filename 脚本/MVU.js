// 本卡 MVU 加载入口；请求检查仅作用于当前脚本 iframe。
// BEGIN MVU_REQUEST_ERRORS (源: 前端 util/mvu-request-errors.js)
/** 仅识别错误响应，不扫描正常剧情或补丁内的关键词。 @param {unknown} value @returns {string | null} */
function describeMvuRequestError(value) {
  let error = null;
  if (value instanceof Error || (value && typeof value === 'object' && /Error$/.test(value.name) && typeof value.message === 'string')) error = value.message;
  else if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.error) error = value.error;
    else if (value.promptFeedback?.blockReason) error = value.promptFeedback.blockReason;
    else if (Array.isArray(value.candidates) && value.candidates.length &&
      value.candidates.every(candidate => ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST'].includes(candidate.finishReason))) {
      error = value.candidates[0].finishReason;
    }
  } else if (typeof value === 'string') {
    const text = value.trim();
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') return describeMvuRequestError(parsed);
    } catch { /* 非 JSON 响应仅接受明确的错误前缀。 */ }
    if (/^(?:Error\s*:|API (?:request )?(?:error|failed)\b|请求失败\s*[:：]|PROHIBITED_CONTENT\b)/i.test(text)) error = text;
  }
  if (error == null) return null;
  const text = typeof error === 'string' ? error : JSON.stringify(error);
  if (/PROHIBITED_CONTENT|\bSAFETY\b|\bBLOCKLIST\b|blocked.*(?:safety|content)|prompt.*(?:blocked|could not be submitted)/i.test(text))
    return '供应商拒绝了变量更新请求（内容限制），未取得变量补丁。请检查通道的限制说明。';
  if (/\b401\b|UNAUTHENTICATED|invalid[_ ]api[_ ]key|authentication|incorrect api key/i.test(text))
    return '变量更新 API 鉴权失败，请检查该连接的密钥。';
  if (/\b403\b|PERMISSION_DENIED|forbidden/i.test(text))
    return '变量更新 API 无访问权限，请检查账号、模型与通道权限。';
  if (/\b429\b|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(text))
    return '变量更新 API 额度不足或触发限流，请检查额度或稍后重试。';
  if (/\b50[0234]\b|overloaded|UNAVAILABLE|server busy/i.test(text))
    return '变量更新 API 暂时不可用，请稍后重试。';
  if (/timeout|timed out|network|failed to fetch|fetch failed/i.test(text))
    return '变量更新请求超时或网络连接失败，请检查连接后重试。';
  // 不回显原始错误，避免反代错误中夹带请求正文、密钥或 HTML。
  return '变量更新 API 请求失败，未取得变量补丁。请查看供应商或酒馆后台的原始错误。';
}

/** 只安装在本卡 MVU 自己的 iframe 中，不修改父页面或其他脚本。 @param {any} scope @param {(message: string) => void} notify */
function installMvuRequestGuard(scope, notify) {
  const restores = [];
  let lastMessage = '', lastTime = 0;
  const report = message => {
    const now = Date.now();
    if (message !== lastMessage || now - lastTime > 4000) notify(message);
    lastMessage = message; lastTime = now;
  };
  for (const key of ['generate', 'generateRaw']) {
    const original = scope[key];
    if (typeof original !== 'function') continue;
    const wrapped = async function (...args) {
      let result;
      try { result = await original.apply(this, args); }
      catch (error) {
        // 手动停止保持原有行为，不提示供应商故障。
        if (error?.name === 'AbortError' || /abort|cancel|手动停止|用户取消/i.test(String(error?.message ?? error))) throw error;
        const message = describeMvuRequestError(error);
        if (message) report(message);
        throw error;
      }
      const message = describeMvuRequestError(result);
      if (message) {
        report(message);
        // 在 MVU 的 JSON Patch 校验之前终止，不用空补丁伪装成功。
        throw new Error(message);
      }
      return result;
    };
    scope[key] = wrapped;
    restores.push(() => { if (scope[key] === wrapped) scope[key] = original; });
  }
  return () => restores.forEach(restore => restore());
}

// END MVU_REQUEST_ERRORS

$(() => {
  const restore = installMvuRequestGuard(globalThis, message => toastr.error(message, '变量更新请求失败', { escapeHtml: true }));
  $(window).on('pagehide', restore);
  import('https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js')
    .catch(error => {
      restore();
      console.error('[本格修仙 MVU] 加载失败', error);
      toastr.error('MVU 脚本加载失败，请检查网络后重新加载脚本。');
    });
});
