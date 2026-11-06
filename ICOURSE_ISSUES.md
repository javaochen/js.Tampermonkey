# icourse 脚本已知问题

记录 `same_tab.user.js` 与 `icourse_cleaner.js` 中已确认存在的问题、证据与待验证的修复方向。

---

## 问题 1：VSCode 内置浏览器中播放器无法启动

**影响面**：仅影响 VSCode 内置浏览器调试，**不影响真实浏览器**。

**现象**

进入 `https://icourse.fudan.edu.cn/livingroom?course_id=...` 后，无论是否安装脚本：

- `#cmc_cmcPlayer_container` 子节点数为 `0`
- 页面中不存在 `<video>` 元素
- 手动点击「确认」也无法播放

**证据**

1. 在已登录标签页中，不注入任何脚本，仅观察：播放器容器仍为空。
2. 点击确认后，弹窗容器的类名变为
   `el-dialog__wrapper sign_dialog dialog-fade-leave dialog-fade-leave-active`，
   即退场动画已开始，但长时间停留在 `*-leave-active` 状态不结束——说明页面渲染帧被挂起。
3. 用户反馈同一操作「手动点击在 VSCode 不行、在浏览器可以」。

**结论**

属于 VSCode 内置浏览器的媒体解码 / 渲染环境限制，与两个脚本均无因果关系。
**不需要在脚本侧修复**，但调试时应改用真实浏览器验证。

---

## 问题 2：确认弹窗自动化尚未在真实浏览器完成端到端验收

**影响面**：`icourse_cleaner.js`。

**已确认正确的部分**（在真实页面实测，可复现）

| 步骤 | `input.checked` | 确认按钮 `disabled` |
|---|---|---|
| 初始 | `false` | `true`（站点设置） |
| 脚本执行 `.click()` 勾选后 | `true` | `false`（Vue 自行解除） |
| 点击确认后 | — | 容器进入 `dialog-fade-leave` |

- 脚本**没有**改写 `disabled` 属性，也没有绕过站点的确认流程。
- 触发的是站点自己绑定的 `click` handler（`btn.__vue__.$listeners.click` 存在）。
- 实测勾选后按钮立即解除禁用，轮询次数为 `0`。

**尚未验证的部分**

由于问题 1 的渲染限制，无法在 VSCode 内置浏览器中观察「确认之后播放器是否正常开始播放并计时」这一最终结果。需要在真实 Chrome / Edge 中安装脚本后确认：

1. 每节课进入时弹窗是否被自动关闭；
2. 关闭后播放器是否正常加载并开始播放；
3. 站点的学习时长统计是否正常累加。

**若真实浏览器中仍有问题，优先排查方向**

1. **点击时机**：脚本用 `setTimeout(50ms)` 轮询等待 `disabled` 解除。若站点在某次更新中改为依赖 `@input` 而非 `@change`，勾选后业务状态可能未同步。
2. **是否为原生 `click()`**：脚本使用 `HTMLElement.click()`，部分站点会校验 `event.isTrusted`。若站点有此校验，需改用 `dispatchEvent(new MouseEvent(...))`——注意这仍不是可信事件，无法绕过 `isTrusted` 检查。
3. **弹窗复用**：若站点复用同一个 DOM 节点在多次进入不同课程时反复展示，`__icHandled` 标记会导致后续不再处理。当前实现按元素打标记，未做「重新展示时重置」。
4. **多个 iframe**：`livingroom` 页面当前无 iframe，但若站点改版把播放器或弹窗移入 iframe，需确认脚本注入范围。

**已知的真实缺陷（已修复）**

- 初版无幂等保护：勾选引发的 DOM 变化会反复触发 `MutationObserver`，实测重复点击「确认」26 次。现已通过 `__icHandled` 修复。
- 初版用 `offsetParent` 判断弹窗可见性，退场动画期间元素仍 `display:block`，会误判为未关闭并重复点击。现已改为检测 `dialog-fade-leave`。

---

## 问题 3：`same_tab.user.js` 的 iframe 依赖

**影响面**：`same_tab.user.js`。

**背景**

课程列表位于 `https://icourse.fudan.edu.cn/portal/#/homePage` 的同源 iframe 中，点击课程时在 **iframe 内部**执行：

```js
window.open("https://icourse.fudan.edu.cn/coursedetail?course_id=...", "_blank")
```

**约束**

- 脚本**不能**声明 `@noframes`，否则在 iframe 内完全不运行，拦截失效（这是 v4 → v5.1 的根因）。
- iframe 内拦截后必须调用 `top.location.assign()`；只改子 frame 自己的 `location` 只会重载子页面。

**已实测通过**

在真实页面注入等价逻辑后点击课程：标签页数量保持 `1`，当前页 URL 变为
`https://icourse.fudan.edu.cn/coursedetail?course_id=38343&tenant_code=222`。

---

## 附：为何早期版本全部无效

| 版本 | 做法 | 失效原因 |
|---|---|---|
| v3.x | 改写 `<a target>`、包装 `createElement`/`setAttribute` | 课程跳转用的是 `window.open`，页面无 `<a target="_blank">` |
| v4.0 | 只处理 `target` 属性 | 同上 |
| v5.0 | 在顶层窗口劫持 `window.open` | 站点代码跑在 iframe 内，顶层劫持覆盖不到 |
| v5.1 | 移除 `@noframes` + `top.location` | 已生效 |
