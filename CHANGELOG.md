# 更新日志

## [0.1.0] — 2026-11-08

- **P1/P2 交互收敛**：第 1 步“授予访问权限”中文右移 8px（英文位置不变）；
  两页都不再显示 Enter/Space/点击提示；第 2 步移除“确认身份”按钮，身份卡
  自动停留 2 秒，并加入一次轻量电视方格花屏。第 1 步的按钮 / Enter / 空格 /
  点击触发条件保持不变；按钮出现后立即接受点击，扫描线结束前点击会在扫描线
  真实结束 +100ms 切页，不再等待语音或额外淡出。扫描线结束后点击则直接切页。
- **自动幕停留下限**：P3/P4/P5 默认停留放宽为 1600/1600/2000ms；引擎增加
  1000ms 实际墙钟下限，播放倍速调到 3× 时每幕也不会短于 1 秒。
- **XTDS 定制 fork**：基于上游 `baec191` / `v2.16.11`，项目最终定名
  `xtds-start-dsh`（开发过程中曾用 `xtds-boot-suite`），版本 `0.1.0`，
  `private: true`，不发布 npm、不上架公开插件商店；支持从本仓库 GitHub 地址直装。
- **默认只保留暖白前半段**：`template: 'archive-warm'`、`act2: ''`；正常启动不再出现
  `#dsh-startup-act2`，旧模板/旧 `act2` 自动归一化为暖白单幕。
- **保留第二幕揭示引擎**：图片/视频、时间轴、关键帧、扫描线、CRT、故障、HUD、
  泛光、暗角、转场和 `playSecondTemplate()` 均保留。
- **新增可替换形象空槽位** `templates/xtds-character-reveal`：仅含 XTDS 通用占位线稿，
  默认关闭，不内置任何现成角色。
- **设置页导入流程**：新增「🖼️ 导入自定义形象」与「恢复内置占位」；
  PNG/JPEG/WEBP/GIF，≤20MB，校验文件头，拒绝 SVG；只写本机用户模板目录。
- **身份资料独立文件**：身份名称、身份编号、权限等级从
  `~/.dsh/dsh-startup.json` 拆到 `~/.dsh/dsh-startup-identity.json`；
  旧配置会自动迁移。公开默认值仍为 `JOYCE MOORE / 0087 / 3`，示例见
  `config/dsh-startup-identity.example.json`，个人身份资料不随仓库发布。
- **安全回退**：导入图片缺失/损坏时回退 `character-slot.svg`，启动动画仍安全结束，
  不黑屏。
- **品牌与素材清理**：bundle/loader/package/installer 标识改为 `xtds-start-dsh`；
  删除鲸鱼娘、全景大肥鱼、550C、深海声呐等上游模板与媒体素材；默认壁纸改为
  XTDS 暖白档案底图。
- **本机插件商城试装**：新增 `tools/local-market.mjs` 与 `启动本地商城.cmd`，
  只监听 `127.0.0.1`，提供 format-1 索引和本机 npm registry；可在 DSH 的
  “插件 → 发现”里添加索引源并直接安装。它不是公开商店，也不会上传包。
- **本机商城验证**：`test/smoke-local-market.mjs` 覆盖索引、tarball 完整性、
  npm 实际安装和访问边界，共 45 项检查。
- **更新与商店 fail-closed**：默认关闭；只有显式设置 `XTDS_UPDATE_REPO` /
  `DSH_STORE_URL` 才启用，更新资产只接受 `xtds-start-dsh-win*.zip`。
- **署名保留**：MIT `LICENSE`、上游仓库链接、沈宏宏暖白视觉署名、
  LeeRolling 上游维护署名均保留；详见 `CREDITS.md`。
- **许可文件**：保留沈宏宏的原始 MIT 版权声明，并追加
  `Copyright (c) 2026 Xavier Trump`；`LICENSE` 现已分栏标注
  **原始作品（沈宏宏）** 与 **XTDS fork / 二次创作（Xavier Trump）**，
  并明确后者仅覆盖 fork 修改与新增部分，不改变上游 MIT 授权正文。
- **验证工具**：新增 `tools/visual-check.mjs` 与 `tools/fixtures/test-character.png.b64`，
  使用临时 `DSH_HOME` 和无头 Edge 检查默认暖白、占位、导入、缺图回退与运行时异常。
- **文档精简**：根目录只保留 `README.md`、`README.en.md`、`INSTALL.md`、
  `CREDITS.md`、`CHANGELOG.md`、`AGENTS.md`；`docs/` 只保留模板格式、
  DSH 大版本升级检查清单和 4 张当前视觉截图；删除上游阶段笔记、分享文案、
  商店提交材料与过时音频字段说明。

## 上游历史

本 fork 从 `0.1.0` 开始记录。上游 `2.x` 变更见
[LeeRolling/dsh-boot-suite releases](https://github.com/LeeRolling/dsh-boot-suite/releases)
和上游提交历史。
