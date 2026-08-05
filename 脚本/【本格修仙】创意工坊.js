(() => {
  'use strict';

  const workshopUrl =
    'https://testingcf.jsdelivr.net/gh/Awene/tavern_helper_template-main@v1.0.36/dist/创意工坊/index.js';
  const positionKey = 'cultivation-workshop-launcher-position';
  const themeKey = 'rb-theme';
  const launcherSize = () => (window.parent.innerWidth < 600 ? 46 : 54);
  const launcherZIndex = 2147483500;
  const $tavernDocument = $(window.parent.document);
  let loadingPromise = null;
  let dragged = false;
  let position = readPosition();

  installVueFeatureFlags();

  const $style = $('<style>')
    .attr('script_id', getScriptId())
    .text(`
      .cultivation-workshop-launcher {
        display: flex; align-items: center; justify-content: center;
        border: 2px solid rgba(169, 59, 62, .68); border-radius: 50%;
        color: #9e3136; background:
          radial-gradient(circle at 32% 25%, rgba(255, 255, 255, .72), transparent 43%),
          linear-gradient(145deg, #fff8e8 0%, #f2dfbd 63%, #d9bd8b 100%);
        box-shadow: 0 0 18px rgba(157, 83, 63, .32), inset 0 2px 4px rgba(255,255,255,.72),
          inset 0 -4px 7px rgba(120,82,31,.16), 0 7px 18px rgba(0,0,0,.32);
        font-family: 'Ma Shan Zheng','KaiTi',serif; font-size: 23px; line-height: 1;
        transition: filter .2s ease, box-shadow .2s ease; animation: cw-launcher-pulse 3.4s ease-in-out infinite;
        pointer-events: auto;
      }
      .cultivation-workshop-launcher.is-dark {
        border-color: rgba(205, 170, 104, .72); color: #f1c7a5; background:
          radial-gradient(circle at 32% 25%, rgba(211, 91, 97, .34), transparent 45%),
          linear-gradient(145deg, #362233 0%, #251824 58%, #140f19 100%);
        box-shadow: 0 0 18px rgba(196, 75, 79, .42), inset 0 2px 4px rgba(255,255,255,.14),
          inset 0 -4px 7px rgba(0,0,0,.42), 0 7px 18px rgba(0,0,0,.48);
      }
      .cultivation-workshop-launcher:hover { filter: brightness(1.13); box-shadow: 0 0 27px rgba(195,73,68,.72), 0 9px 22px rgba(0,0,0,.56); }
      .cultivation-workshop-launcher:active { filter: brightness(.92); }
      .cultivation-workshop-launcher.is-loading { animation-duration: .8s; cursor: progress !important; }
      .cultivation-workshop-launcher.is-error { border-color: #ffb0a7; box-shadow: 0 0 24px rgba(230,70,60,.85); }
      @keyframes cw-launcher-pulse {
        0%,100% { box-shadow: 0 0 14px rgba(151,48,47,.38), inset 0 2px 4px rgba(255,255,255,.22), 0 7px 18px rgba(0,0,0,.48); }
        50% { box-shadow: 0 0 25px rgba(195,73,68,.68), inset 0 2px 4px rgba(255,255,255,.26), 0 7px 18px rgba(0,0,0,.48); }
      }
      @media (max-width:599px) { .cultivation-workshop-launcher { font-size: 20px; } }
    `)
    .appendTo('head');

  const $launcher = $('<button type="button">')
    .attr({
      script_id: getScriptId(),
      class: 'cultivation-workshop-launcher',
      title: '打开创意工坊（可拖动）',
      'aria-label': '打开创意工坊',
    })
    .text('坊')
    .css({
      position: 'fixed', left: 0, top: 0, width: `${launcherSize()}px`, height: `${launcherSize()}px`,
      zIndex: launcherZIndex, cursor: 'grab', userSelect: 'none', touchAction: 'none', willChange: 'transform',
    })
    .appendTo('body');

  syncLauncherTheme();
  clampPosition();
  applyPosition();
  bindDrag();
  $launcher.on('click', async () => {
    if (dragged) {
      dragged = false;
      return;
    }
    $launcher.removeClass('is-error').addClass('is-loading');
    try {
      const workshop = await loadWorkshop();
      workshop.open();
    } catch (error) {
      console.error('[创意工坊] 打开失败:', error);
      $launcher.addClass('is-error');
      toastr.error('请查看浏览器控制台中的“[创意工坊]”错误', '创意工坊打开失败');
    } finally {
      $launcher.removeClass('is-loading');
    }
  });

  window.parent.addEventListener('resize', handleResize, { passive: true });
  window.parent.addEventListener('rb-theme-change', handleThemeChange);
  window.parent.addEventListener('storage', syncLauncherTheme);
  void loadWorkshop().catch(error => console.error('[创意工坊] 预加载失败:', error));

  function findWorkshopBridge() {
    for (const candidate of [window, window.parent, window.top]) {
      try {
        if (candidate?.CultivationWorkshop?.open) return candidate.CultivationWorkshop;
      } catch (_) {}
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
      try { await import(workshopUrl); } catch (error) { importError = error; console.warn('[创意工坊] 前端模块加载异常:', error); }
      for (let index = 0; index < 100; index += 1) {
        const bridge = findWorkshopBridge();
        if (bridge) return bridge;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw importError || new Error('创意工坊前端接口初始化超时');
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

  function applyPosition() {
    $launcher.css('transform', `translate3d(${position.x}px, ${position.y}px, 0)`);
  }

  function bindDrag() {
    $launcher.on('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      const start = { x: event.clientX, y: event.clientY };
      const origin = { ...position };
      let moved = false;
      $launcher.css('animation', 'none');
      event.preventDefault();
      const onMove = moveEvent => {
        const dx = moveEvent.clientX - start.x;
        const dy = moveEvent.clientY - start.y;
        if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) moved = true;
        if (!moved) return;
        position = { x: origin.x + dx, y: origin.y + dy };
        clampPosition();
        applyPosition();
        moveEvent.preventDefault();
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
