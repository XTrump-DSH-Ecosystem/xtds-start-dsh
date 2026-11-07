# AGENTS.md · XTDS fork 工作规范

最后更新：2026-11-08

## 一、项目坐标

| 项目 | 值 |
|---|---|
| 仓库根目录 | 当前 checkout（本机绝对路径不要提交到公开仓库） |
| 上游 | `https://github.com/LeeRolling/dsh-boot-suite` |
| 上游基点 | `baec191` / `v2.16.11` |
| 干净备份 | 本机 `backups/clean-baec191-v2.16.11-20261107-193812`（不随仓库分发） |
| 当前包名/版本 | `xtds-start-dsh` / `0.1.0` / `private: true`（旧名 `xtds-boot-suite` 仅保留卸载兼容） |
| 用户配置 | `~/.dsh/dsh-startup.json` |
| 身份资料 | `~/.dsh/dsh-startup-identity.json` |
| 用户模板 | `~/.dsh/startup-templates/` |
| 诊断日志 | `~/.dsh/boot-suite-diag.log` |

当前分支是 `main`，worktree 可能包含大量未提交改动。
不要提交、推送、打 tag、发 Release、发 npm 或安装到真实 profile，
除非用户在当前会话明确授权。

## 二、产品默认行为

- 默认第一幕：`template: 'archive-warm'`。
- 默认第二幕：`act2: ''`，启动时不得出现 `#dsh-startup-act2`。
- 旧模板/旧 `act2` 必须归一化为暖白单幕，不能黑屏。
- 只允许两个内置模板：
  - `templates/archive-warm`
  - `templates/xtds-character-reveal`
- **不要删除第二幕引擎**。图片/视频、时间轴、特效、`playSecondTemplate()` 和
  fallback 都是后续用户换形象的基础。
- `xtds-character-reveal` 只能是数据驱动的空槽位；不得重新塞回上游角色素材。
- 用户通过设置页导入形象，不要求手改 JSON。
- 允许并推荐通过 DSH 的「插件 → 添加插件 → 安装第三方插件」直接粘贴本仓库
  GitHub 地址安装；不要把用户入口重新写成只能本机商城或 `安装.cmd`。

## 三、硬约束

1. **所有命令显式使用 PowerShell。** 默认 WSL/bash 已损坏，不要调用 `bash`。
2. 编辑文件只用 `apply_patch`，不要用脚本重写源码。
3. 不修改 `xtds-assistant-dsh`、`ds-memory`、`qq-gateway` 或真实 DSH profile。
4. 所有 DSH 测试必须使用临时 `DSH_HOME`，打印路径，结束后清理。
5. 不把真实用户配置、token、私有日志或绝对敏感路径写入交付物。
   身份资料只写本机 `~/.dsh/dsh-startup-identity.json`；仓库默认值与示例必须保持公开的
   `JOYCE MOORE / 0087 / 3`，不得写入任何真实用户身份。
6. 不降低测试阈值、不跳过门禁、不伪造截图或测试结果。
7. 模板只能是纯 JSON 数据，不执行模板代码。
8. 用户导入只接受 PNG / JPEG / WEBP / GIF，≤20MB，校验魔数，拒绝 SVG。
9. 在线更新与商店默认关闭；只有显式 `XTDS_UPDATE_REPO` / `DSH_STORE_URL` 才启用。
10. 保留 MIT `LICENSE`、上游链接、沈宏宏暖白视觉署名、LeeRolling 维护署名。

本地验收和构建可以运行 `node tools/build-release.mjs`，产物必须同时生成并核对
`xtds-start-dsh-win.zip`、`xtds-start-dsh.tgz` 与 `SHA256SUMS.txt`。
构建不等于获准发布：上传 Release、提交商店或安装到真实 profile 仍需用户明确授权。

## 四、常用验证

```powershell
npm test
node tools/motion-check.mjs --template=archive-warm --speed=3
node tools/motion-check.mjs --template=xtds-character-reveal --speed=2
node tools/visual-check.mjs --speed=3
```

本机若无 Chrome，可指定 Edge：

```powershell
node tools/visual-check.mjs --speed=3 --chrome="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
```

视觉脚本会：

- 使用临时 DSH_HOME；
- 验证默认启动无第二幕；
- 验证占位线稿、导入图片、缺图回退；
- 写入 `docs/evidence/` 截图。

截图必须实际查看后再声称通过。

## 五、测试隔离模板

```powershell
$tmp = Join-Path $env:TEMP ('xtds-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
$env:DSH_HOME = $tmp
try {
  node test/smoke-host.mjs
} finally {
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item Env:DSH_HOME -ErrorAction SilentlyContinue
}
```

不要把临时目录设成 `$HOME` 或真实 `~/.dsh`。
PowerShell 里 `$home` / `$HOME` 是只读自动变量，不能拿来当临时目录变量。

## 六、关键文件

| 文件 | 作用 |
|---|---|
| `lib/host-startup.js` | 宿主路由、默认配置、模板读取、形象导入/重置 |
| `lib/splash.js` | 启动运行时与第二幕揭示引擎 |
| `lib/client.js` | 设置页与浏览器半侧 |
| `lib/host-wallpaper.js` | 聊天壁纸 |
| `templates/archive-warm/template.json` | 默认暖白序章 |
| `templates/xtds-character-reveal/template.json` | 第二幕空槽位 |
| `config/dsh-startup-identity.example.json` | 身份资料示例（公开默认值） |
| `tools/visual-check.mjs` | 真实无头浏览器验收 |
| `tools/fixtures/test-character.png.b64` | 视觉验收用小型有效 PNG |
| `test/smoke-package.mjs` | fork 包身份、模板、安全与署名检查 |
| `test/smoke-character-import.mjs` | 形象导入安全测试 |
| `test/smoke-fork.mjs` | 默认值、归一化、更新/商店关闭测试 |

## 七、文档与署名

- 用户入口：`README.md`、`README.en.md`、`INSTALL.md`
- 来源与修改说明：`CREDITS.md`
- 历史：`CHANGELOG.md` 只记录本 fork `0.1.0` 及以后；上游历史链接到上游仓库，
  不再把 2.x 条目复制进本仓库。
- 许可：`LICENSE` 必须分栏保留并区分沈宏宏的 **原始作品** 版权与
  `Xavier Trump` 的 **XTDS fork / 二次创作** 版权；不得把两者混成同一作者。
- 维护文档：`docs/模板格式.md`、`docs/DSH大版本升级兼容性检查清单.md`。
- 根目录文档保持精简：`README.md`、`README.en.md`、`INSTALL.md`、`CREDITS.md`、
  `CHANGELOG.md`、`AGENTS.md`；不要重新加入上游阶段笔记、工单、商店申请材料
  或过时音频字段说明。
- 发布物料（分享文案、B 站文案等）放在本机 `03-发布包/`，不要提交到公开仓库。
- 安装文案不得引用上游 Release 下载地址，也不得把鲸鱼娘写成默认第二幕；
  GitHub 直装应使用本 fork 仓库地址。
- 旧截图不得代表当前默认画面；只使用 `docs/evidence/` 的新截图。

## 八、协作流程

适用于改文件或需要真实验证的任务，不适用于纯问答/一行修复/状态查询。

- **Worker**：只在分配路径内实现，不扩范围；缺少必要决策时停下报告。
- **Tester**：独立检查 diff、运行真实命令、看截图/产物，不信任 Worker 自述。
- 主 Agent 负责 task card、聚合、拒绝不完整输出、最终复核。
- 常规改动：一个 Worker + 一个 Tester；小型明确改动可自做并自检。
- 并行写入范围不得重叠。
- 以下必须先给出选项与利弊：换核心框架/第三方库、改架构或公开 API、
  有显著性能/成本影响的路线、破坏性或不可逆操作。

禁止：

- 冲突标记；
- 绕过 CI、降低阈值、放宽 lint、跳过门禁；
- 未验证就宣称完成；
- 大范围无关改动；
- 把 mock 证据当真实验证；
- 泄漏 secrets / token / 私有路径 / 日志。

收尾必须说明：改了什么、实际验证了什么、没跑什么、残余风险。
