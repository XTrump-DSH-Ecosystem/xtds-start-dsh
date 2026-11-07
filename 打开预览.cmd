@echo off
chcp 65001 >nul
setlocal

set "HERE=%~dp0"
set "PAGE=%HERE%preview\index.html"

if not exist "%PAGE%" (
  echo [x] 找不到预览页: %PAGE%
  pause
  exit /b 1
)

echo.
echo   xtds-start-dsh - 暖白启动动画离线预览
echo   ------------------------------------------------
echo   预览页: %PAGE%
echo.
echo   打开后:
echo     1) 默认播放暖白档案序章，不出现黑暗角色揭示
echo     2) 右上角控制台可改身份名称 / 权限等级 / 速度
echo     3) 第 1 步点按钮或按 Enter 继续；第 2 步身份卡自动停留 2 秒
echo     4) 第二幕导入按钮只在已安装 DSH 的设置页生效；离线预览不会写配置
echo.

start "" "%PAGE%"
exit /b 0
