@echo off
:: deploy.bat의 설정을 그대로 가져옴
set NODE_PATH=C:\Program Files\nodejs
set PATH=%NODE_PATH%;%PATH%
set WRANGLER=%APPDATA%\npm\wrangler.cmd

echo ==========================================
echo [D1 데이터베이스 생성 작업]
echo ==========================================
echo.
echo 1. Cloudflare D1 생성을 시도합니다...
echo.

:: wrangler 실행
"%WRANGLER%" d1 create accounting-db

echo.
echo ------------------------------------------
echo 위 화면에 'database_id = "..." ' 부분이 보이나요?
echo 보인다면 그 ID(따옴표 안의 글자)만 복사해서 저에게 알려주세요!
echo.
echo 만약 오류가 난다면, 화면을 캡처해서 보여주세요.
echo ------------------------------------------
pause
