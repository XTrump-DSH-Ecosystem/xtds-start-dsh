# 安装提示词（给其他用户的 AI 用）

> 用法：把下面整段贴进 Windows 电脑上的 DSH / Claude / Codex 助手。
> 这是 **XTDS 私有定制版**，不要换成上游 `dsh-boot-suite` 的在线安装地址。

```text
你是我的 Windows 电脑助手。请帮我安装本地插件包 xtds-start-dsh 0.1.0。

背景：
- 这是基于 LeeRolling/dsh-boot-suite 的 XTDS 定制 fork，不是上游官方版本。
- 默认只播放暖白「技术档案」序章，不播放黑暗角色揭示。
- 第二幕揭示引擎保留；之后我可以从设置页导入自己的图片。
- 包名是 xtds-start-dsh（旧名 xtds-boot-suite 仅用于卸载兼容），private: true，不存在 npm 公共包。

边界（必须遵守）：
- 只动安装插件所需的文件，不要删除或改写我 ~/.dsh 下的模板、配置和聊天记录。
- 不要从上游 GitHub Release 或 npm 下载同名包。
- 不要执行来源不明的脚本，不要使用管理员权限做无关操作。
- 不要擅自结束 DeepSeek Harness 进程。
- 不要自动启动 DeepSeek Harness。

步骤：
1. 让我提供 XTDS 本地发布包或本仓库路径。确认根目录有：
   - package.json，name 必须是 xtds-start-dsh，version 必须是 0.1.0，private 必须是 true；
   - 安装.cmd；
   - tools\install.ps1；
   - 诊断.cmd；
   - templates\archive-warm 和 templates\xtds-character-reveal。
2. 检查 DSH 是否正在运行。如果在运行，只提醒我：
   「请完全退出 DSH（窗口 + 右下角托盘），退出后告诉我」。
   不要自己杀进程。
3. 我确认已退出后，让我双击「安装.cmd」，并把窗口最后 10 行发给你。
4. 安装完成后检查：
   - %USERPROFILE%\.dsh\profiles\desktop\package.json 的 dependencies
     和 dsh.profile.bundles 中有 xtds-start-dsh；
   - %USERPROFILE%\.dsh\profiles\desktop\node_modules\xtds-start-dsh 存在。
   - 如果 web profile 存在，也同样检查。
5. 告诉我手动重新打开 DSH，并确认：
   - 设置页出现「启动动画」和「聊天背景」；
   - 默认启动只出现暖白序章，没有第二幕；
   - 设置 → 启动动画 → 第二幕 中有「导入自定义形象」和「恢复内置占位」。
6. 如果安装失败，让我运行安装目录里的「诊断.cmd」，
   把生成的 dsh诊断-*.txt 总结给你；不要让我反复重试超过 2 次。

输出要求：每一步给一句结果；最后给「接下来我要做的 3 件事」。
```

## 给普通用户的手动步骤

1. 完全退出 DeepSeek Harness（窗口 + 托盘）。
2. 解压 XTDS 本地发布包或本仓库。
3. 双击 **安装.cmd**。
4. 安装完成后手动重开 DSH。
5. 设置页找到「启动动画」。

## 导入自定义形象

安装后：

1. **设置 → 启动动画**。
2. 找到 **第二幕**。
3. 点击 **🖼️ 导入自定义形象**。
4. 选择 PNG / JPEG / WEBP / GIF，单张不超过 20MB。
5. 想恢复占位线稿，点击 **恢复内置占位**。

不要要求用户手改 `~/.dsh/dsh-startup.json`。

## 不要使用的旧安装方式

以下方式属于上游默认流程，本 fork 不再使用：

- 从 `github.com/LeeRolling/dsh-boot-suite/releases` 下载；
- `irm .../install-online.ps1 | iex`；
- 安装 npm 包 `dsh-boot-suite`；
- 期待默认出现鲸鱼娘或六幕角色揭示。

需要在线更新时，必须由维护者显式设置 `XTDS_UPDATE_REPO`；
需要模板商店时，必须显式设置 `DSH_STORE_URL`。
