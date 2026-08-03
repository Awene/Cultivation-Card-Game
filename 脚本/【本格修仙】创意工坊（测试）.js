(() => {
  'use strict';

  const workshopUrl = `http://localhost:5500/dist/创意工坊/index.js?workshop_test=${Date.now()}`;
  const $tavernDocument = $(window.parent.document);
  const launcherZIndex = 2147483500;
  const size = () => (window.parent.innerWidth < 600 ? 46 : 54);
  let loadingPromise = null;
  let dragged = false;
  let position = { x: window.parent.innerWidth - size() - 24, y: window.parent.innerHeight - size() - 92 };

  installVueFeatureFlags();

  const $style = $('<style>')
    .attr('script_id', getScriptId())
    .text(`
      .cultivation-workshop-launcher-test { display:flex;align-items:center;justify-content:center;border:2px dashed #d8b46e;border-radius:50%;color:#fff8e8;background:linear-gradient(145deg,#597d70,#315247);box-shadow:0 0 20px rgba(70,135,110,.6),0 7px 18px rgba(0,0,0,.48);font:20px/1 'KaiTi',serif;pointer-events:auto;animation:cw-test-pulse 2.4s ease-in-out infinite; }
      .cultivation-workshop-launcher-test::after { content:'试';position:absolute;right:-3px;top:-5px;padding:2px 4px;border-radius:8px;background:#8d3033;color:white;font:9px/1 sans-serif; }
      .cultivation-workshop-launcher-test.is-loading { cursor:progress!important;animation-duration:.7s; }
      .cultivation-workshop-launcher-test.is-error { box-shadow:0 0 24px rgba(230,70,60,.9); }
      @keyframes cw-test-pulse { 50% { filter:brightness(1.2);box-shadow:0 0 29px rgba(90,175,142,.82),0 7px 18px rgba(0,0,0,.48); } }
    `)
    .appendTo('head');
  const $launcher = $('<button type="button">')
    .attr({ script_id: getScriptId(), class: 'cultivation-workshop-launcher-test', title: '打开创意工坊测试版（可拖动）', 'aria-label': '打开创意工坊测试版' })
    .text('坊')
    .css({ position:'fixed',left:0,top:0,width:`${size()}px`,height:`${size()}px`,zIndex:launcherZIndex,cursor:'grab',userSelect:'none',touchAction:'none',willChange:'transform' })
    .appendTo('body');
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
  function applyPosition() { $launcher.css('transform', `translate3d(${position.x}px, ${position.y}px, 0)`); }
  function clampPosition() {
    position.x = Math.max(0, Math.min(window.parent.innerWidth - size(), position.x));
    position.y = Math.max(0, Math.min(window.parent.innerHeight - size(), position.y));
  }
  function bindDrag() {
    $launcher.on('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      const start = { x:event.clientX, y:event.clientY };
      const origin = { ...position };
      let moved = false;
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
        if (moved) dragged = true;
        upEvent.preventDefault();
      };
      $tavernDocument.on('pointermove', onMove).on('pointerup pointercancel', onUp);
    });
  }
  $(window).on('pagehide', () => { $launcher.remove(); $style.remove(); });
})();
