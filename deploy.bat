@echo off
chcp 65001 >nul
set WRANGLER=wrangler
wrangler --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  if exist "%APPDATA%\npm\wrangler.cmd" (
    set WRANGLER="%APPDATA%\npm\wrangler.cmd"
  )
)
echo === 시스템 무결성 검출 시작 ===
node scripts/verify-integrity.js
if %ERRORLEVEL% NEQ 0 (
  echo ❌ CRITICAL: 시스템 파일이 손상되었거나 인코딩이 깨졌습니다. 배포를 중단합니다.
  pause
  exit /b %ERRORLEVEL%
)

echo === 자산 해싱(Cache Busting) 시작 ===
node scripts/hash-assets.js

echo === 자동 배포 시작 (API 토큰 사용) ===
call %WRANGLER% pages deploy . --project-name yewon-accounting --branch main --commit-dirty=true
echo === 배포 완료 ===
