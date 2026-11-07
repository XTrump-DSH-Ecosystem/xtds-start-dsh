# 桌面端适配说明

本插件同时面向 web profile 与 DeepSeek Harness Desktop。两侧使用同一份代码，
不需要两个包。

| | web profile | desktop profile |
|---|---|---|
| 载体 | `dsh web` 本地服务 | DeepSeek Harness Desktop（Electron） |
| profile | `%USERPROFILE%\.dsh\profiles\web` | `%USERPROFILE%\.dsh\profiles\desktop` |
| 安装 | `dsh plugin --profile web add link:...` | `dsh plugin --profile desktop add link:...` |
| 重启 | 关掉启动器再开 | 完全退出桌面端（含托盘）再开 |

## 安装

先完全退出桌面端，再执行：

```powershell
dsh plugin --profile desktop add link:D:\path\to\dsh-boot-suite
```

> 把 `D:\path\to\dsh-boot-suite` 换成本仓库的实际绝对路径；包名是 `xtds-start-dsh`。

也可以双击 `安装.cmd`。安装器会识别 profile、处理旧插件名残留并做自检。

> desktop profile 的 `package.json` 由桌面端进程锁管理。运行中写入可能被覆盖，
> 所以应先完全退出。

## 默认启动行为

- 第一幕：`archive-warm` 暖白档案序章。
- 第二幕：空，不加载 `#dsh-startup-act2`。
- 旧配置引用已删除模板时回落暖白单幕。
- 可选第二幕 `xtds-character-reveal` 保留，形象可在设置页导入。

## 与 web 的差异

桌面端通常也挂载 `@deepseek-ai/dsh-web-app`，因此有 `webServer` 时可复用：

- `/dsh-startup/*` 路由；
- `webserver/index-inject` 首屏注入；
- `/dsh-startup/config` 配置读写；
- 模板与形象导入路由。

如果该载体没有可用的 index 注入，浏览器半侧会自举：

| 标记 | 含义 |
|---|---|
| `__DSH_STARTUP_BOOT__ = 'index'` | 宿主已注入，浏览器半侧不重复播放 |
| `__DSH_STARTUP_BOOT__ = 'client'` | 浏览器半侧已自举 |
| `__DSH_STARTUP_SKIP__` | 宿主已判定本次不播 |
| `__DSH_STARTUP_FAILED__ = true` | 自愈兜底已把页面还回去 |

自举遵循同一套 `enabled` / `session` / `daily` 判定，并写回
`sessionStorage` / `localStorage`。脚本或样式加载失败时会解除滚动锁并移除黑幕，
避免把用户留在黑屏。

## 导入形象

桌面端路径与 web 相同：

**设置 → 启动动画 → 第二幕 → 🖼️ 导入自定义形象**

- 仅 PNG / JPEG / WEBP / GIF；
- 最大 20MB；
- 宿主校验魔数，拒绝 SVG；
- 写入本机 `~/.dsh/startup-templates/xtds-character-reveal/`；
- 「恢复内置占位」会删除该本机覆盖。

## 验证情况

已在隔离 `DSH_HOME` + 无头 Edge 中验证：

- 默认暖白序列有运动；
- 默认不出现第二幕；
- 启动根节点被移除并触发 `done`；
- 明确启用第二幕后占位线稿可见；
- 导入测试 PNG 后图层可见；
- 删除图片后回退占位且动画安全结束；
- 视觉验收 35 通过 / 0 失败。

**没有**在真实 DeepSeek Harness Desktop 实机上启动验证，也没有安装到真实 profile。
如果真机表现异常，按下面顺序排查：

1. 设置页是否出现「启动动画」；没有则插件未装入或未重启。
2. 看 console 是否有 `[dsh-startup]` / `[dsh-startup-screen]` 错误。
3. 手查 `http://127.0.0.1:<端口>/dsh-startup/splash.js`：
   - 401：路由已注册（信任栅栏正常）；
   - 404：插件未装好或未重启。
4. 看 `~/.dsh/boot-suite-diag.log`。

## 测试

```powershell
npm test
node tools/motion-check.mjs --template=archive-warm --speed=3
node tools/motion-check.mjs --template=xtds-character-reveal --speed=2
node tools/visual-check.mjs --speed=3
```

所有涉及 DSH 数据的测试应使用临时 `DSH_HOME` 并清理。
