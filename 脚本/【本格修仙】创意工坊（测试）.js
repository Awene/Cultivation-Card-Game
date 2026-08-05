(() => {
  'use strict';

  const workshopUrl = `http://localhost:5500/dist/创意工坊/index.js?workshop_test=${Date.now()}`;
  const positionKey = 'cultivation-workshop-launcher-test-position';
  const $tavernDocument = $(window.parent.document);
  const launcherZIndex = 2147483500;
  const themeKey = 'rb-theme';
  const launcherSize = () => (window.parent.innerWidth < 600 ? 46 : 54);
  let loadingPromise = null;
  let dragged = false;
  let position = readPosition();

  installVueFeatureFlags();

  const $style = $('<style>')
    .attr('script_id', getScriptId())
    .text(`
      .cultivation-workshop-launcher-test { display:flex;align-items:center;justify-content:center;border:2px dashed rgba(169,59,62,.72);border-radius:50%;color:#9e3136;background:radial-gradient(circle at 32% 25%,rgba(255,255,255,.72),transparent 43%),linear-gradient(145deg,#fff8e8 0%,#f2dfbd 63%,#d9bd8b 100%);box-shadow:0 0 18px rgba(157,83,63,.32),inset 0 2px 4px rgba(255,255,255,.72),inset 0 -4px 7px rgba(120,82,31,.16),0 7px 18px rgba(0,0,0,.32);font:23px/1 'Ma Shan Zheng','KaiTi',serif;pointer-events:auto;animation:cw-test-pulse 3.4s ease-in-out infinite;transition:filter .2s ease,box-shadow .2s ease; }
      .cultivation-workshop-launcher-test.is-dark { border-color:rgba(205,170,104,.72);color:#f1c7a5;background:radial-gradient(circle at 32% 25%,rgba(211,91,97,.34),transparent 45%),linear-gradient(145deg,#362233 0%,#251824 58%,#140f19 100%);box-shadow:0 0 18px rgba(196,75,79,.42),inset 0 2px 4px rgba(255,255,255,.14),inset 0 -4px 7px rgba(0,0,0,.42),0 7px 18px rgba(0,0,0,.48); }
      .cultivation-workshop-launcher-test::after { content:'试';position:absolute;right:-3px;top:-5px;padding:2px 4px;border-radius:8px;background:#a93b3e;color:white;font:9px/1 sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.34); }
      .cultivation-workshop-launcher-test:hover { filter:brightness(1.13);box-shadow:0 0 27px rgba(195,73,68,.72),0 9px 22px rgba(0,0,0,.56); }
      .cultivation-workshop-launcher-test.is-loading { cursor:progress!important;animation-duration:.7s; }
      .cultivation-workshop-launcher-test.is-error { box-shadow:0 0 24px rgba(230,70,60,.9); }
      @keyframes cw-test-pulse { 50% { filter:brightness(1.12);box-shadow:0 0 25px rgba(195,73,68,.68),0 7px 18px rgba(0,0,0,.48); } }
      @media (max-width:599px) { .cultivation-workshop-launcher-test { font-size:20px; } }
    `)
    .appendTo('head');
  const $launcher = $('<button type="button">')
    .attr({ script_id: getScriptId(), class: 'cultivation-workshop-launcher-test', title: '打开创意工坊测试版（可拖动）', 'aria-label': '打开创意工坊测试版' })
    .text('坊')
    .css({ position:'fixed',left:0,top:0,width:`${launcherSize()}px`,height:`${launcherSize()}px`,zIndex:launcherZIndex,cursor:'grab',userSelect:'none',touchAction:'none',willChange:'transform' })
    .appendTo('body');
  syncLauncherTheme();
  clampPosition();
  applyPosition();

  $launcher.on('click', async () => {
    if (dragged) { dragged = false; return; }
    $launcher.removeClass('is-error').addClass('is-loading');
    try { (await loadWorkshop()).open(); }
    catch (error) {
      console.error('[创意工坊（测试）] 打开失败:', error);
      $launcher.addClass('is-error');
      toastr.error('请确认 Go Live 已启动且端口为 5500', '创意工坊测试版打开失败');
    } finally { $launcher.removeClass('is-loading'); }
  });
  bindDrag();
  window.parent.addEventListener('resize', handleResize, { passive: true });
  window.parent.addEventListener('rb-theme-change', handleThemeChange);
  window.parent.addEventListener('storage', syncLauncherTheme);
  void loadWorkshop().catch(error => console.error('[创意工坊（测试）] 预加载失败:', error));

  function findWorkshopBridge() {
    for (const candidate of [window, window.parent, window.top]) {
      try { if (candidate?.CultivationWorkshop?.open) return candidate.CultivationWorkshop; } catch (_) {}
    }
    return null;
  }
  function installVueFeatureFlags() {
    for (const candidate of [window, window.parent, window.top]) {
      try {
        candidate.__VUE_OPTIONS_API__ ??= false;
        candidate.__VUE_PROD_DEVTOOLS__ ??= false;
        candidate.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ ??= false;
      } catch (_) {}
    }
  }
  function loadWorkshop() {
    const existing = findWorkshopBridge();
    if (existing) return Promise.resolve(existing);
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      let importError = null;
      try { await import(workshopUrl); } catch (error) { importError = error; console.warn('[创意工坊（测试）] 前端模块加载异常:', error); }
      for (let index = 0; index < 100; index += 1) {
        const bridge = findWorkshopBridge();
        if (bridge) return bridge;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw importError || new Error('创意工坊测试前端接口初始化超时');
    })();
    return loadingPromise;
  }
  function readPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(positionKey) || 'null');
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return saved;
    } catch (_) {}
    return { x: window.parent.innerWidth - launcherSize() - 24, y: window.parent.innerHeight - launcherSize() - 92 };
  }
  function applyPosition() { $launcher.css('transform', `translate3d(${position.x}px, ${position.y}px, 0)`); }
  function syncLauncherTheme() {
    let theme = 'dark';
    try { theme = window.parent.localStorage.getItem(themeKey) || 'dark'; } catch (_) {}
    $launcher.toggleClass('is-dark', theme !== 'light');
  }
  function handleThemeChange(event) {
    const theme = event?.detail;
    if (theme === 'light' || theme === 'dark') $launcher.toggleClass('is-dark', theme === 'dark');
    else syncLauncherTheme();
  }
  function clampPosition() {
    position.x = Math.max(0, Math.min(window.parent.innerWidth - launcherSize(), position.x));
    position.y = Math.max(0, Math.min(window.parent.innerHeight - launcherSize(), position.y));
  }
  function bindDrag() {
    $launcher.on('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      const start = { x:event.clientX, y:event.clientY };
      const origin = { ...position };
      let moved = false;
      $launcher.css('animation', 'none');
      event.preventDefault();
      const onMove = moveEvent => {
        const dx = moveEvent.clientX - start.x, dy = moveEvent.clientY - start.y;
        if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) moved = true;
        if (!moved) return;
        position = { x:origin.x + dx, y:origin.y + dy };
        clampPosition(); applyPosition(); moveEvent.preventDefault();
      };
      const onUp = upEvent => {
        $tavernDocument.off('pointermove', onMove).off('pointerup pointercancel', onUp);
        $launcher.css('animation', '');
        if (moved) {
          dragged = true;
          localStorage.setItem(positionKey, JSON.stringify(position));
        }
        upEvent.preventDefault();
      };
      $tavernDocument.on('pointermove', onMove).on('pointerup pointercancel', onUp);
    });
  }
  function handleResize() {
    clampPosition();
    $launcher.css({ width: `${launcherSize()}px`, height: `${launcherSize()}px` });
    applyPosition();
  }
  $(window).on('pagehide', () => {
    window.parent.removeEventListener('resize', handleResize);
    window.parent.removeEventListener('rb-theme-change', handleThemeChange);
    window.parent.removeEventListener('storage', syncLauncherTheme);
    $launcher.remove();
    $style.remove();
  });
})();
