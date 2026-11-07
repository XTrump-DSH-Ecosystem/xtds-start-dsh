#!/bin/sh
# xtds-start-dsh —— 档案暖白启动离线预览（macOS / Linux）
# 用法：./open-preview.sh   或者   sh open-preview.sh
set -e

HERE=$(cd "$(dirname "$0")" && pwd)
PAGE="$HERE/preview/index.html"

if [ ! -f "$PAGE" ]; then
  echo "[x] 找不到预览页: $PAGE" >&2
  exit 1
fi

cat <<EOF

  xtds-start-dsh - 档案暖白启动离线预览
  ------------------------------------------------
  预览页: $PAGE

  打开后:
    1) 默认播放暖白档案序章，不出现黑暗角色揭示
    2) 右上角控制台可改身份名称 / 权限等级 / 速度
    3) 第 1 步点按钮或按 Enter 继续；第 2 步身份卡自动停留 2 秒
    4) 第二幕导入按钮只在已安装 DSH 的设置页生效；离线预览不会写配置

EOF

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$PAGE"
elif command -v open >/dev/null 2>&1; then
  open "$PAGE"
else
  echo "  没找到 xdg-open / open，请手动在浏览器里打开上面那个路径。"
fi
