@echo off
:: Use UTF-8 encoding
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ==========================================
echo [1/3] Cloudflare D1 Database Setup
echo ==========================================

:: 1. Setup PATH (Matching deploy.bat)
set NODE_PATH=C:\Program Files\nodejs
set PATH=%NODE_PATH%;%PATH%
set WRANGLER_PATH=%APPDATA%\npm\wrangler.cmd

:: Check if Node exists
node -v > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found at %NODE_PATH%.
    echo Please check if Node.js is installed.
    pause
    exit /b 1
)

:: Check if Wrangler exists, if not use npx
if exist "%WRANGLER_PATH%" (
    set RUN_CMD="%WRANGLER_PATH%"
) else (
    echo Wrangler not found at %WRANGLER_PATH%, using npx...
    set RUN_CMD=npx wrangler
)

echo.
echo Creating D1 database 'accounting-db'...
echo (If a browser window opens, please login)
echo.

:: Run wrangler d1 create
call %RUN_CMD% d1 create accounting-db > d1_result.txt 2>&1

:: Check result and extract database_id
set DB_ID=
for /f "tokens=2 delims=: " %%a in ('findstr "database_id =" d1_result.txt') do (
    set DB_ID=%%a
    set DB_ID=!DB_ID:"=!
)

if "%DB_ID%"=="" (
    echo [ERROR] Failed to get database_id.
    echo --- Error Log Start ---
    type d1_result.txt
    echo --- Error Log End ---
    echo.
    echo Re-trying with direct execution (might show login prompts)...
    call %RUN_CMD% d1 create accounting-db
    pause
    exit /b 1
)

echo SUCCESS! database_id = %DB_ID%

echo.
echo [2/3] Updating wrangler.toml...
(for /f "tokens=*" %%i in (wrangler.toml) do (
    set "line=%%i"
    if "!line:~0,12!"=="database_id " (
        echo database_id = "%DB_ID%"
    ) else (
        echo !line!
    )
)) > wrangler.toml.new
move /y wrangler.toml.new wrangler.toml > nul

echo.
echo [3/3] Applying schema.sql...
call %RUN_CMD% d1 execute accounting-db --file=schema.sql --local=false --yes

echo.
echo ==========================================
echo Setup Completed Successfully!
echo You can now run deploy.bat to deploy.
echo ==========================================
del d1_result.txt
pause
