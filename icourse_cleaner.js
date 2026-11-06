// ==UserScript==
// @name         icourse 自动确认规范提示
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动勾选「我已阅读」并点确认，省去每节课开始前的资源使用规范弹窗
// @homepageURL  https://github.com/javaochen/js.Tampermonkey
// @supportURL   https://github.com/javaochen/js.Tampermonkey/issues
// @downloadURL  https://raw.githubusercontent.com/javaochen/js.Tampermonkey/main/icourse_cleaner.js
// @updateURL    https://raw.githubusercontent.com/javaochen/js.Tampermonkey/main/icourse_cleaner.js
// @match        *://icourse.fudan.edu.cn/*
// @exclude      *://icourse.fudan.edu.cn/login*
// @exclude      *://icourse.fudan.edu.cn/cas/*
// @exclude      *://icourse.fudan.edu.cn/oauth*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORE_KEY = 'icourse_autoConfirm';
  const IN_FRAME = window.top !== window.self;
  let enabled = GM_getValue(STORE_KEY, true);

  // 只处理这一种提示，签到 / 互动答题 / 退出确认等其它弹窗一律不碰
  const TITLE_HINT = '平台资源使用的规范提示';
  const CHECK_HINT = '我已阅读';

  const visible = el => !!el && el.offsetParent !== null;
  const text = el => (el?.innerText || '').trim();

  function visibleDialogs() {
    return [...document.querySelectorAll('.el-dialog, .el-message-box')].filter(visible);
  }

  function isTarget(dialog) {
    return text(dialog.querySelector('.el-dialog__title, .el-message-box__title')).includes(TITLE_HINT)
      || text(dialog.querySelector('.el-checkbox__label, .el-checkbox')).includes(CHECK_HINT);
  }

  // 按钮文字可能是「确认」「确 认」或带空白，统一去掉所有空白再比对
  const flat = el => text(el).replace(/\s+/g, '');

  const confirmButton = dialog =>
    [...dialog.querySelectorAll('button')].find(b => flat(b) === '确认');

  function handle(dialog) {
    // 同一个弹窗元素只处理一次：MutationObserver 会因点击引发的 DOM 变化反复触发
    if (dialog.__icHandled) return;
    dialog.__icHandled = true;

    const box = dialog.querySelector('.el-checkbox');
    const input = dialog.querySelector('input[type="checkbox"]');
    if (box && input && !input.checked) box.click();

    const confirm = confirmButton(dialog);
    if (!confirm) return;

    // 等复选框的 v-model 同步到父组件、确认按钮自己解除 disabled 后再点。
    // 绝不直接改 disabled：站点要靠这次真实点击走完「已确认」的业务流程。
    let tries = 0;
    const tryClick = () => {
      // 弹窗已进入淡出动画，说明确认已生效，不用再点
      if (dialog.closest('.el-dialog__wrapper')?.className.includes('dialog-fade-leave')) return;
      if (!visible(dialog)) return;
      const checked = dialog.querySelector('input[type="checkbox"]')?.checked;
      if (!checked && tries === 3) dialog.querySelector('.el-checkbox')?.click();
      if (checked && !confirm.disabled) {
        confirm.click();
        return;
      }
      if (++tries < 40) setTimeout(tryClick, 50);
    };
    tryClick();
  }

  function scan() {
    if (!enabled) return;
    visibleDialogs().filter(isTarget).forEach(handle);
  }

  const obs = new MutationObserver(scan);

  function start() {
    if (start._on) return;
    start._on = true;
    obs.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'disabled']
    });
    scan();
  }

  if (document.documentElement) start();
  else new MutationObserver((_, o) => {
    if (document.documentElement) { start(); o.disconnect(); }
  }).observe(document, { childList: true });

  let cmd;
  function refreshMenu() {
    if (cmd) GM_unregisterMenuCommand(cmd);
    if (IN_FRAME) return;
    cmd = GM_registerMenuCommand(`icourse 自动确认规范提示：${enabled ? '开' : '关'}`, () => {
      enabled = !enabled;
      GM_setValue(STORE_KEY, enabled);
      refreshMenu();
      toast(enabled ? '已开启：自动勾选并确认' : '已关闭：恢复手动确认');
    });
  }
  if (!IN_FRAME) refreshMenu();

  function toast(msg) {
    let el = document.getElementById('icourse-cleaner-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'icourse-cleaner-toast';
      el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;background:#1a73e8;color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .2s';
      document.body?.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 1500);
  }
})();
