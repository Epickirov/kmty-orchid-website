@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist saas cd ..
node -e "require('node:sqlite')" >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [!] 需要 Node.js 22.5 或以上版本（本机演示唯一的依赖）
  echo      国内下载：https://npmmirror.com/mirrors/node/v22.12.0/node-v22.12.0-x64.msi
  echo      安装后重新双击本文件。
  echo.
  pause
  exit /b 1
)
node --no-warnings saas\seed.js --demo
set ADMIN_PASS=admin888
echo.
echo  ================= KMTY 星商 · 本地演示 =================
echo   买家店铺   http://localhost:8787/s/lanyuan
echo   卖家中心   http://localhost:8787/seller    (lanyuan / demo888)
echo   平台控制台 http://localhost:8787/admin     (密码 admin888)
echo   星空定制页 http://localhost:8787/r/lanyuan
echo  ========================================================
echo   全部在本机运行，不联网、不涉及域名，关掉本窗口即停止。
echo.
start "" cmd /c "timeout /t 2 >nul & start "" http://localhost:8787/s/lanyuan"
node --no-warnings saas\server.js
pause
