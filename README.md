# Tampermonkey 脚本集

个人自用的几个 Tampermonkey 脚本。安装后由脚本管理器自动检查更新。

| 脚本 | 安装 | 版本 | 适用站点 |
|---|---|---|---|
| 网页悬浮目录 | [安装](https://raw.githubusercontent.com/javaochen/js.Tampermonkey/main/toc.user.js) | 4.3.0 | 所有网页 |
| AI Switcher | [安装](https://raw.githubusercontent.com/javaochen/js.Tampermonkey/main/ai-switcher.user.js) | 1.4.3 | ChatGPT、Claude、Gemini、DeepSeek、元宝、豆包、Kimi、千问、Qwen、ChatGLM、Grok、讯飞星火、Copilot、秘塔 |
| 最新问题→标签页标题 | [安装](https://raw.githubusercontent.com/javaochen/js.Tampermonkey/main/tab-title.user.js) | 1.1.0 | 元宝 `chatMode=temp` 对话页 |
| 站内链接强制当前页打开 | [安装](https://raw.githubusercontent.com/javaochen/js.Tampermonkey/main/same_tab.user.js) | 6.0 | icourse 智慧教学资源平台、百度、Google、必应 |
| icourse 自动确认规范提示 | [安装](https://raw.githubusercontent.com/javaochen/js.Tampermonkey/main/icourse_cleaner.js) | 1.0 | icourse 智慧教学资源平台 |

## 功能速览

**网页悬浮目录**：右下角悬浮按钮，点击展开文章层级目录；按钮可拖动或点选放到任意位置，位置自动记忆，双击复位。标题少于 2 个的页面不显示面板。

**AI Switcher**：在 AI 聊天页面显示一条可拖动、可排序的 AI 快捷图标栏。单击切换、Ctrl/Cmd+单击或中键新标签打开。快捷键：`Alt+\`` 收起/展开，`Alt+1~9` 切换，`Alt+[` / `Alt+]` 前后切换。已兼容 Trusted Types 与严格 CSP 站点。

**最新问题→标签页标题**：把当前会话里最后一条用户提问同步到标签页标题，方便在多标签间辨认。

**站内链接强制当前页打开**：让链接在点击后留在当前标签页，而不是弹新页。分两类站点：

- **icourse**：课程列表在 `portal` 同源 iframe 里，点课程会 `window.open(url, "_blank")`。脚本在页面主世界劫持 `window.open`，同源链接改为当前页跳转，登录/下载链接仍开新标签。因为要注入 iframe，**脚本不能加 `@noframes`**。
- **百度 / Google / 必应**：搜索结果普遍是 `<a target="_blank">`，脚本在 DOM 层面移除 `target`。这类站点不限制同源（结果本身就是外链），也不按 `login`/`download` 关键字跳过——搜索结果 URL 里经常带这些词。

两类站点都只改「是否开新标签」，不接管当前页导航，所以浏览器后退仍能回到搜索结果页。

**icourse 自动确认规范提示**：每节课开始前会弹「关于平台资源使用的规范提示！」，需要勾选「我已阅读」再点「确认」。脚本检测到这个弹窗时自动勾选并确认。只匹配这一种弹窗，签到、互动答题、退出确认等其它弹窗不会被动。

## 从旧版迁移

如果你装过下面任意一个旧版本，请**先卸载再装新链接**，否则页面上可能同时存在两个目录按钮（两者使用同一个根节点 id，先加载的会生效）：

- 旧版「自动顶部目录」（已归档到 [`legacy/`](legacy/)）
- 旧版「网页悬浮目录」（通过旧链接安装的副本）

另外，旧版本没有 `@updateURL`，需要手动重装一次，之后的版本才会自动更新。

## 已知限制

- 目录脚本注入所有站点（`@match *://*/*`）。样式优先使用 constructed stylesheet，浏览器不支持或被拦截时才回退到 `<style>`；两种路径都不依赖 `innerHTML`，因此兼容 Trusted Types。
- 标题脚本目前只适配元宝的 `chatMode=temp` 页面，且依赖站点的用户消息选择器；站点改版后需要更新选择器。
- 标题脚本使用 `@include` 而不是 `@match` 匹配 `chatMode=temp`，因为 Chrome 风格的 match 模式不匹配查询串。
- `raw` 主分支链接意味着每次推送都会立即对所有用户生效。
- icourse 相关脚本的问题记录、复现步骤与待验证项见 [`ICOURSE_ISSUES.md`](ICOURSE_ISSUES.md)。其中 VSCode 内置浏览器无法启动播放器属于环境限制，请用真实浏览器验收。

## 接入新脚本（外部生成后整理）

这里的脚本经常先在别处生成，再拿过来优化。合入前按顺序过一遍，能避免大部分“装两遍”“更新失效”“某站点报错”的问题：

1. **先查重**：搜索同名或同功能脚本。旧版本放进 `legacy/`，命名为 `<slug>-v<version>.user.js.txt`，不要留在根目录。
2. **文件名**：小写 ASCII，`<slug>.user.js`（不要空格、中文、箭头）。
3. **metadata**：补齐 `@homepageURL`、`@supportURL`、`@downloadURL`、`@updateURL`（指向本文件）和 `@noframes`；`@name` / `@namespace` 一旦发布就不要再改，否则 TM 会当成新脚本。
4. **删除占位内容**：示例域名（`your-ai-site.com`）、示例选择器、调试日志。
5. **语法检查**：`node --check <file>`。
6. **常见坑**：
   - `innerHTML` 在开启 Trusted Types 的站点（ChatGPT、Gemini 等）会抛错 → 用 DOM API。
   - 注入 `<style>` 可能被 CSP 拦截 → 优先 `adoptedStyleSheets`，失败再回退。
   - `@match` 不匹配查询串 → 需要匹配 `?key=value` 时改用 `@include`。
   - 快捷键用 `e.key` 在 macOS 上会被 Option 组合键改写（`Option+1` 是 `¡`）→ 用 `e.code`。
   - 监听整个 `body` 的 `characterData` 会被 AI 流式输出打爆 → 只订阅 `childList`，或缩小观察范围。
   - 监听全文档 `MutationObserver` 只为检测 URL 变化 → 改用 `pushState` / `replaceState` / `popstate` 钩子。
7. **版本与文档**：按 patch/minor 递增 `@version`，同步更新上面的版本表。

## 开发

当前是纯单文件脚本，尚未引入构建流程。后续计划：

1. 修复已知问题（CSP / Trusted Types、全文档 MutationObserver、macOS 快捷键）。
2. 引入 `src/` + esbuild，打包输出到 `dist/`。
3. 抽取共享模块（站点适配、拖拽定位、CSP 安全的 DOM/样式工具）。

## 许可

[MIT](LICENSE)
