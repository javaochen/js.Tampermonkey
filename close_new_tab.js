// ==UserScript==
// @name         强制当前页打开（icourse）
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  让 icourse 的链接在当前标签页打开，不再弹新页
// @homepageURL  https://github.com/javaochen/js.Tampermonkey
// @supportURL   https://github.com/javaochen/js.Tampermonkey/issues
// @downloadURL  https://raw.githubusercontent.com/javaochen/js.Tampermonkey/main/close_new_tab.js
// @updateURL    https://raw.githubusercontent.com/javaochen/js.Tampermonkey/main/close_new_tab.js
// @match        *://icourse.fudan.edu.cn/*
// @exclude      *://icourse.fudan.edu.cn/login*
// @exclude      *://icourse.fudan.edu.cn/cas/*
// @exclude      *://icourse.fudan.edu.cn/oauth*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const STORE_KEY = 'icourse_sameTab';
  // 课程列表在 portal iframe 里，会话值要能跨 frame 共享；多 frame 时菜单只注册一次
  const IN_FRAME = window.top !== window.self;
  let enabled = GM_getValue(STORE_KEY, true);
  const ORIG = 'data-ic-origin-target';
  // 站点代码跑在页面主世界，必须改那里原型上的 window.open，改沙箱里的没用
  const pageWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const isNewTarget = target => /^(?:_blank|_new)$/i.test(String(target || ''));
  const isExternal = el => el.getAttribute('rel') === 'external' || el.hasAttribute('download');

  // 登录、鉴权、下载类链接一律不动
  const SKIP = ['login', 'cas', 'oauth', 'callback', 'captcha', 'download', 'export'];
  const isSkipUrl = (href) => {
    if (!href) return true;
    const u = href.toLowerCase();
    if (/^(mailto:|tel:|blob:|data:|javascript:)/.test(u) || u.startsWith('#')) return true;
    return SKIP.some(k => u.includes(k));
  };

  // 同源页面在主世界内直接换地址，保留站点自己的登录态与生命周期
  const nativeOpen = pageWin.open;
  function sameTabOpen(url, target, features) {
    if (!enabled) return nativeOpen.call(pageWin, url, target, features);
    const wantsNewTab = !target || isNewTarget(target);
    if (wantsNewTab && url && !isSkipUrl(url)) {
      let abs;
      try { abs = new URL(url, pageWin.location.href); } catch { abs = null; }
      // 只接管本站页面；跨域链接仍交给浏览器开新标签
      if (abs && abs.origin === pageWin.location.origin) {
        // iframe 里改自己的 location 只会重载子页面，必须让整个顶层窗口导航
        const targetWin = IN_FRAME ? pageWin.top : pageWin;
        try { targetWin.location.assign(abs.href); } catch { pageWin.location.assign(abs.href); }
        return targetWin;
      }
    }
    return nativeOpen.call(pageWin, url, target, features);
  }
  // 课程列表位于同源 iframe（portal/#/homePage）里，因此脚本不能加 @noframes
  try {
    pageWin.open = sameTabOpen;
    if (pageWin !== window) window.open = sameTabOpen;
  } catch { /* 部分站点对 window.open 只读 */ }

  // 首次加载期间站点可能覆盖 window.open，短暂自愈几次
  let selfHeal = 0;
  const healOpen = () => {
    if (pageWin.open !== sameTabOpen) {
      try { pageWin.open = sameTabOpen; } catch { /* 忽略 */ }
    }
    if (++selfHeal < 20) setTimeout(healOpen, 150);
  };
  healOpen();

  // 兜底：站点偶尔直接写 target="_blank"，只改 DOM 属性，不包装原生 API。
  function neutralize(el) {
    if (el.nodeType !== 1 || isExternal(el)) return;
    if (el.matches('base[target]') && isNewTarget(el.getAttribute('target'))) {
      // <base target> 会让 href 为空的链接也命中白名单，因此这里不再判断 URL
      el.setAttribute('target', '_self');
    }
    if (el.matches('a[target],area[target]')) {
      const t = el.getAttribute('target');
      if (isNewTarget(t)) {
        if (!el.hasAttribute(ORIG)) el.setAttribute(ORIG, t);
        el.removeAttribute('target');
      }
    }
    el.querySelectorAll?.('base[target],a[target],area[target]').forEach(neutralize);
  }

  function scan(root) {
    if (enabled) neutralize(root);
  }

  // 只处理 target 属性；站点常延迟生成链接，DOM 稳定后再补扫一遍。
  function rescanLater() {
    setTimeout(() => { if (enabled) scan(document.documentElement); }, 500);
    setTimeout(() => { if (enabled) scan(document.documentElement); }, 2000);
    window.addEventListener('load', () => { if (enabled) scan(document.documentElement); }, { once: true });
  }

  const obs = new MutationObserver(muts => {
    if (!enabled) return;
    for (const m of muts) {
      if (m.type === 'attributes') {
        if (isNewTarget(m.target.getAttribute('target'))) neutralize(m.target);
      } else {
        m.addedNodes.forEach(n => scan(n));
      }
    }
  });

  function start() {
    if (!document.documentElement || start._on) return;
    obs.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['target']
    });
    start._on = true;
    scan(document.documentElement);
    rescanLater();
    startWatchOpen();
  }

  // window.open 的拦截可能被站点或其它脚本覆盖，持续校验并在丢失时补挂
  let watchTimer = 0;
  function startWatchOpen() {
    if (watchTimer) return;
    watchTimer = setInterval(() => {
      if (!enabled || document.hidden) return;
      if (pageWin.open !== sameTabOpen) {
        try { pageWin.open = sameTabOpen; } catch { /* 忽略 */ }
      }
      if (window !== pageWin && window.open !== sameTabOpen) {
        try { window.open = sameTabOpen; } catch { /* 忽略 */ }
      }
    }, 1000);
  }
  if (document.documentElement) start();
  else new MutationObserver((_, o) => {
    if (document.documentElement) { start(); o.disconnect(); }
  }).observe(document, { childList: true });

  let cmd;
  function refreshMenu() {
    if (cmd) GM_unregisterMenuCommand(cmd);
    if (IN_FRAME) return;
    cmd = GM_registerMenuCommand(`icourse当前页打开：${enabled ? '开' : '关'}`, () => {
      enabled = !enabled;
      GM_setValue(STORE_KEY, enabled);
      if (enabled) start();
      else document.querySelectorAll(`[${ORIG}]`).forEach(el => {
        el.setAttribute('target', el.getAttribute(ORIG));
        el.removeAttribute(ORIG);
      });
      refreshMenu();
      if (!IN_FRAME) toast(enabled ? '已开启：当前页打开' : '已关闭：恢复默认');
    });
  }
  if (!IN_FRAME) refreshMenu();

  function toast(msg) {
    let el = document.getElementById('icourse-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'icourse-toast';
      el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;background:#1a73e8;color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .2s';
      document.body?.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => el.style.opacity = '0', 1500);
  }
})();
