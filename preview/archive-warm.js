/* 离线预览用的 archive-warm 模板快照。
 * 源文件：templates/archive-warm/template.json
 * 静态 file:// 页面不能 fetch JSON，因此在这里以脚本形式注入。
 * 视觉原作者：沈宏宏 @6shenhonghong9；上游维护：LeeRolling；MIT License。
 */
window.__DSH_STARTUP_TEMPLATE__ = {
  "schemaVersion": 1,
  "id": "archive-warm",
  "name": "档案暖白",
  "author": "沈宏宏",
  "homepage": "https://github.com/LeeRolling/dsh-boot-suite",
  "license": "MIT",
  "version": "1.1.2",
  "description": "暖白技术档案底板 + 五步授权。视觉原作者沈宏宏；LeeRolling 合并维护；XTDS 定制版裁剪为默认单幕。",
  "tags": ["minimal", "light", "archive"],
  "theme": {
    "accent": "#ff7500",
    "glitchA": "#ff3b30",
    "glitchB": "#2971b8"
  },
  "steps": [
    {
      "zh": "需要访问许可",
      "en": "ACCESS PERMISSION REQUIRED",
      "say": "Access permission required.",
      "audio": "line-1",
      "log": "等待用户授权…",
      "logEn": "AWAITING OPERATOR CONSENT",
      "badge": "AUTHORIZATION",
      "action": "grant",
      "btnZh": "授予访问权限",
      "btnEn": "GRANT ACCESS",
      "hold": 900,
      "progress": 0.34
    },
    {
      "zh": "身份资料确认",
      "en": "IDENTITY VERIFICATION",
      "say": "Identity verification.",
      "audio": "line-2",
      "log": "核对身份资料…",
      "logEn": "MATCHING OPERATOR RECORD",
      "badge": "IDENTITY",
      "action": "auto",
      "card": true,
      "tvGlitch": true,
      "hold": 2000,
      "holdExact": true,
      "progress": 0.5
    },
    {
      "zh": "接收访问需求",
      "en": "ACCESS REQUEST RECEIVED",
      "say": "Access request received.",
      "audio": "line-3",
      "log": "接收访问需求，建立会话通道…",
      "logEn": "HANDSHAKE ESTABLISHED",
      "badge": "REQUEST",
      "action": "auto",
      "hold": 1600,
      "progress": 0.66,
      "assembleLogo": true
    },
    {
      "zh": "开始读取权限",
      "en": "PERMISSION READ STARTED",
      "say": "Beginning permission read.",
      "audio": "line-4",
      "log": "开始读取权限，索引工作区与会话…",
      "logEn": "READING PERMISSION SET",
      "badge": "READ",
      "action": "auto",
      "hold": 1600,
      "progress": 0.8,
      "hex": true
    },
    {
      "zh": "读取完毕 · 核验通过",
      "en": "READ COMPLETE · VERIFIED",
      "say": "Read complete. Verification passed.",
      "audio": "line-5",
      "log": "读取完毕，核验通过，权限已授予",
      "logEn": "PERMISSION AUTHORIZED",
      "badge": "VERIFY",
      "action": "auto",
      "hold": 2000,
      "progress": 0.93,
      "reticle": true
    }
  ],
  "adaptedBy": "LeeRolling / XTDS"
};
