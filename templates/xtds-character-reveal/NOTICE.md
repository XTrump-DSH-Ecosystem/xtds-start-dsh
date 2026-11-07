# 自定义形象槽位

这个模板只提供第二幕的“闪烁揭示”机制，不包含任何现成角色。

- `assets/character-slot.svg` 是 XTDS 自制的占位线稿，随本项目按 MIT 许可提供。
- 设置页「启动动画 → 第二幕」下方有「导入自定义形象」按钮，选一张图就会在本机生成同名覆盖模板；不需要手改 JSON。
- 支持 PNG / JPG / JPEG / WEBP / GIF。图片建议使用透明背景，比例 16:9，长边不超过 3840px。
- 高级用户也可以直接改 `template.json` 里 `character-slot` 图层的 `src`，或把图层 `type` 改成 `video`。
- 图片层支持 `fallbackSrc`：导入的图片丢失或损坏时，会自动退回 `assets/character-slot.svg` 占位线稿；动画仍会正常结束，不会黑屏或卡住。
- 想改用视频，保留同一套第二幕机制，把图层 `type` 改为 `video`，并补 `videoW` / `videoH` 与 `src` 即可。

本模板默认不启用。只有用户在「启动动画 → 第二幕」明确选择后才会播放。
