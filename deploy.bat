@echo off
chcp 65001 >nul
set WRANGLER=wrangler
wrangler --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  if exist "%APPDATA%\npm\wrangler.cmd" (
    set WRANGLER="%APPDATA%\npm\wrangler.cmd"
  )
)
echo === 자산 해싱(Cache Busting) 시작 ===
node scripts/hash-assets.js

echo === 자동 배포 시작 (API 토큰 사용) ===
call %WRANGLER% pages deploy . --project-name yewon-accounting --branch main --commit-dirty=true
echo === 배포 완료 ===
