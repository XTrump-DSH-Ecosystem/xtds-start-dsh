# 安装与使用

本仓库是 **XTDS 定制版** `xtds-start-dsh@0.1.0`，不是上游官方包。
旧包名 `xtds-boot-suite` 仅保留作卸载兼容。
不发布 npm，不上架公开插件商店；支持从本仓库 GitHub 地址直接安装，
也保留本机商城和离线安装作为备选。

## 推荐：GitHub 直装

DSH 的插件安装器支持 Git 地址，不需要 npm 包。

1. 打开 DSH 的 **插件** 页。
2. 点 **添加插件** 旁边的下拉箭头，选择 **安装第三方插件**。
3. 粘贴本仓库地址：

   ```text
   https://github.com/XTrump-DSH-Ecosystem/xtds-start-dsh.git
   ```

4. 点 **安装**，完成后点 **立即启用**。
5. 如果提示重启，完全退出 DSH 后重新打开。

说明：

- `private: true` 只阻止 npm 发布，不影响 GitHub 直装；
- 安装需要本机能访问 GitHub，国内网络可能需要代理；
- Git 直装通常不提供版本更新区块，升级时卸载后重新安装。

## 让 AI 助手帮你安装

可以把下面这段发给本机的 DSH / Claude / Codex 助手：

> 请帮我在 Windows 上安装 DSH 插件 `xtds-start-dsh` 0.1.0。
> 这是基于 LeeRolling/dsh-boot-suite 的 XTDS 定制 fork，默认只播放暖白序章。
> 只使用 GitHub 地址
> `https://github.com/XTrump-DSH-Ecosystem/xtds-start-dsh.git` 安装；
> 不要从上游 Release 或 npm 下载同名包，不要手改 profile 或 JSON，
> 不要结束 DSH 进程，也不要自动启动 DSH。
> 安装后检查 profile 的依赖和 `dsh.profile.bundles` 中是否有
> `xtds-start-dsh`；失败时运行 `诊断.cmd`，把最后 10 行结果发给我。

## 备选：在本机插件商城安装

这样可以在 DSH 的 **插件 → 发现** 里像普通插件一样点“安装”，不需要手动改
profile，也不需要找 DSH 的命令行。商城只在 `127.0.0.1` 运行，不会上传包。

1. 双击仓库根目录的 **启动本地商城.cmd**，保持窗口打开。
2. 浏览器会打开说明页，点 **复制地址**。
3. 打开 DSH 的 **插件** 页。
4. 首次使用时，在 **实验性插件** 中启用 **自定义插件索引**。
5. 回到插件页，打开 **发现**，点 **添加索引源**（或工具栏的
   **管理索引源…**），粘贴地址并确认。
6. 找到 **XTDS 暖白启动动画**，点 **安装**，按提示确认。
7. 安装完成后关闭商城窗口；以后需要重装时再启动它。

如果看不到“发现”，先确认“自定义插件索引”已启用，再刷新插件页或重启 DSH。
安装过程中商城窗口必须保持打开，因为 DSH 要从本机索引下载安装包。

## 离线：Windows 本地安装（link 方式）

GitHub 直装和本机商城都不可用时，使用本方式。

1. 取得本仓库或 XTDS 本地发布包并解压。
2. **完全退出** DeepSeek Harness Desktop：
   - 关闭主窗口；
   - 退出右下角托盘；
   - 在任务管理器确认没有 `DeepSeek Harness` 进程。
3. 双击根目录的 **安装.cmd**。
4. 阅读 PowerShell 窗口的每一步提示并确认。
5. 安装成功后，**手动**重新打开 DSH。
6. 设置页应出现：
   - **启动动画**
   - **聊天背景**

安装脚本只安装插件，不会自动启动 DSH。

## 预览（不安装也能看）

双击 **打开预览.cmd**，或直接打开 `preview/index.html`。

- 默认显示暖白档案序章；
- 默认不加载第二幕；
- `preview/demo.html` 是无控制台的纯净演示页，适合截图/录屏；
- 离线预览不会写 `~/.dsh` 配置。

## 导入自定义形象

安装后打开 DSH：

1. **设置 → 启动动画**。
2. 找到 **第二幕**。
3. 点击 **🖼️ 导入自定义形象**。
4. 选择 PNG / JPEG / WEBP / GIF，单张不超过 20MB。
5. 导入成功后会自动选中 `xtds-character-reveal`；点「立即预览」可检查揭示效果。
6. 想恢复通用占位线稿，点击 **恢复内置占位**。

安全与存储说明：

- SVG 不接受；
- 宿主会校验图片文件头，改扩展名的非图片字节会被拒绝；
- 图片只保存在本机 `~/.dsh/startup-templates/xtds-character-reveal/`；
- 不上传、不写入插件安装目录；
- 图片缺失或损坏时回退 `character-slot.svg`，启动动画仍会安全结束。

## 命令行 / 开发者安装

先完全退出 DSH，再执行：

```powershell
dsh plugin --profile desktop add link:D:\path\to\xtds-start-dsh
```

> 把 `D:\path\to\xtds-start-dsh` 换成本仓库的实际绝对路径；目录名不必叫
> `dsh-boot-suite`。安装身份以 `package.json` 的 `xtds-start-dsh` 为准。

如果同时有 web profile，也可以：

```powershell
dsh plugin --profile web add link:D:\path\to\xtds-start-dsh
```

桌面端 profile 的 `package.json` 在运行中会被锁定，所以安装前必须完全退出。
本 fork 不依赖 npm 上的上游包。

## 安装后确认

1. 设置页出现「启动动画」「聊天背景」。
2. 首次启动只播放暖白序章，没有第二幕角色揭示。
3. 打开 `~/.dsh/dsh-startup.json` 时可见：

```json
{
  "template": "archive-warm",
  "act2": ""
}
```

4. 第二幕下拉中应看到 `xtds-character-reveal`，但默认不选中。
5. 聊天区使用 XTDS 暖白默认壁纸。

身份资料现在单独保存在：

```text
%USERPROFILE%\.dsh\dsh-startup-identity.json
```

主配置 `dsh-startup.json` 不再保存身份名称/编号/权限等级。仓库里的示例
`config/dsh-startup-identity.example.json` 沿用原来的公开值
`JOYCE MOORE / 0087 / 3`；自己的身份资料不要提交到 Git。

## 桌面端适配与排错

web profile 与 DeepSeek Harness Desktop 共用同一份代码，不需要两个包。
GitHub 直装对两者相同；本地 link 安装时，desktop 的 profile 位于
`%USERPROFILE%\.dsh\profiles\desktop`。

桌面端注意事项：

- 安装、卸载或更新前必须完全退出桌面端，包括右下角托盘；
- 运行中的 desktop profile 会锁定 `package.json`，边运行边写可能被覆盖；
- 如果桌面端没有可用的 index 注入，浏览器半侧会自举，并通过
  `__DSH_STARTUP_BOOT__`、`__DSH_STARTUP_SKIP__` 和
  `__DSH_STARTUP_FAILED__` 标记状态；
- 脚本或样式加载失败时会解除滚动锁并移除黑幕，避免把用户留在黑屏。

已在隔离 `DSH_HOME` + 无头 Edge 中验证默认暖白、无第二幕、占位线稿、
导入图片和缺图回退；**尚未**在真实 Desktop profile 上安装验证。
真机异常时按顺序检查：

1. 设置页是否出现「启动动画」「聊天背景」；没有则插件未装入或未重启。
2. 控制台是否有 `[dsh-startup]` / `[dsh-startup-screen]` 错误。
3. 访问 `http://127.0.0.1:<端口>/dsh-startup/splash.js`：
   401 表示路由已注册，404 表示插件未装好或未重启。
4. 查看 `~/.dsh/boot-suite-diag.log`，或用 **诊断.cmd** 生成报告。

## 卸载

先完全退出 DSH，再执行：

```powershell
dsh plugin --profile desktop remove xtds-start-dsh
```

如果界面黑屏或点不动，双击根目录的 **卸载.cmd**。
配置文件不会自动删除。需要彻底清理时手动删除：

```text
%USERPROFILE%\.dsh\dsh-startup.json
%USERPROFILE%\.dsh\dsh-startup-identity.json
%USERPROFILE%\.dsh\chat-wallpaper.json
%USERPROFILE%\.dsh\startup-templates\xtds-character-reveal\
```

只删除 `startup-templates\xtds-character-reveal\` 即可清除导入形象；
内置占位线稿仍随插件保留。

## 回滚与排错

- 更新或安装前，安装器会在桌面生成本地回滚入口；
- 回滚只切换插件版本，不改用户配置；
- 诊断日志：`~/.dsh/boot-suite-diag.log`；
- 排错报告可由 **诊断.cmd** 生成。

## 在线更新与商店

默认关闭，不要依赖默认网络下载：

- 更新：只有显式设置 `XTDS_UPDATE_REPO=owner/repo` 才启用；
- 商店：只有显式设置 `DSH_STORE_URL=https://.../index.json` 才启用；
- 更新资产只接受 `xtds-start-dsh-win*.zip`；
- 未配置时安装器会明确提示使用本地 **安装.cmd**。

## 署名与许可

MIT。暖白视觉原作者：沈宏宏（@6shenhonghong9）；
上游合并维护：LeeRolling；XTDS 只做 fork 定制。
完整说明见 [CREDITS.md](CREDITS.md)。
