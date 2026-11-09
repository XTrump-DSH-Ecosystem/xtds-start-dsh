# 鸣谢、来源与修改说明

## 上游项目

- **dsh-boot-suite**：LeeRolling 合并、修复与维护。
  仓库：https://github.com/LeeRolling/dsh-boot-suite
  上游基点：`baec191` / `v2.16.11`
  许可：MIT（随仓库 `LICENSE` 保留）。
- **暖白「技术档案」片头视觉与叙事**：沈宏宏（@6shenhonghong9）。
  原作：https://github.com/6shenhonghong9/dsh-startup-screen

本仓库是 **XTDS 定制 fork**，不是上游官方版本。暖白片头的原始视觉作者是沈宏宏，
上游合并维护者是 LeeRolling；XTDS 只对工程结构与默认行为做定制，不主张这些原始视觉为 XTDS 原创。

## 历史参考（不含当前内置素材）

- 550C 启动动画：@yannicksong0106，
  https://github.com/yannicksong0106/dsh-550c-boot
- 龙娘启动动画线描研究：@mytjxs，
  https://github.com/mytjxs/codex-startup-animation

这些链接只用于来源追溯和动效研究。相关模板与素材已从本 fork 删除，
不代表当前内置内容。

## XTDS 修改

- 默认只播放 `archive-warm` 暖白档案序章；默认 `act2` 为空，不再自动播放任何角色揭示。
- 删除随上游附带的鲸鱼娘、全景大肥鱼、550C、深海声呐等模板与媒体素材。
- 保留第二幕「闪烁揭示」引擎、时间轴、图片/视频、特效和 `playSecondTemplate()` 能力。
- 新增 `xtds-character-reveal` 数据驱动空槽位，仅含 XTDS 自制的通用占位线稿。
- 设置页新增「导入自定义形象」与「恢复内置占位」；导入图片只存本机
  `~/.dsh/startup-templates/xtds-character-reveal/`，不上传。
- 替换为 XTDS 暖白默认聊天壁纸；删除旧内置角色背景。
- 包名、bundle id、loader id 改为 `xtds-start-dsh`，版本为 `0.1.0`，并设为 `private: true`。
  开发过程中曾使用 `xtds-boot-suite`，该旧名仅保留在卸载/残留清理与历史说明中。
- 在线更新与模板商店默认关闭；只有显式设置 `XTDS_UPDATE_REPO` / `DSH_STORE_URL`
  时才启用，且更新资产只接受 `xtds-start-dsh-win*.zip`。

## 不再随包分发

上游历史版本中的鲸鱼娘扫描动画、全景大肥鱼、550C 风格复刻、深海声呐等模板和素材
已从本 fork 删除，不应被当作 XTDS 原创或当前默认内容。相关历史说明仅保留在
上游仓库的提交历史与 Release 中。

## 许可

- 代码：MIT；`LICENSE` 保持标准 MIT 模板，顶部保留沈宏宏与 Xavier Trump
  两行版权声明。
- 版权范围与二次创作说明见 `NOTICE.md`：沈宏宏是暖白「技术档案」视觉与叙事的
  原始作者；Xavier Trump 仅对 XTDS 二次创作中的修改与新增部分主张版权，
  不主张原始视觉或叙事为 XTDS 原创。
- XTDS 新增的工程代码、占位线稿与暖白默认壁纸：同样按 MIT 随本项目提供。
- 用户导入的图片/视频：版权归用户或原权利人，仅保存在本机，不随插件上传或分发。
