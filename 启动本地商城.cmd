@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title XTDS 本机插件商城

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [x] 找不到 Node.js。
  echo     请先安装 Node.js 20 或更高版本，或从 DSH 安装目录使用内置 Node 启动。
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   XTDS 本机插件商城
echo ============================================================
echo.
echo   正在启动本机索引和 npm 安装源...
echo   启动后浏览器会打开操作说明页。
echo   这个窗口需要保持打开，安装完成后再关闭。
echo.

node "%~dp0tools\local-market.mjs" %*
set "RC=%ERRORLEVEL%"

echo.
if not "%RC%"=="0" (
  echo [x] 本机商城已退出，错误码：%RC%
) else (
  echo 本机商城已停止。
)
echo.
pause
exit /b %RC%
