@echo off
echo === Environment Diagnosis === > diag_result.txt
echo PATH: %PATH% >> diag_result.txt
echo APPDATA: %APPDATA% >> diag_result.txt
echo. >> diag_result.txt

echo Checking Node... >> diag_result.txt
node --version >> diag_result.txt 2>&1
if %ERRORLEVEL% EQU 0 (echo Node is available in PATH >> diag_result.txt) else (echo Node NOT found in PATH >> diag_result.txt)

echo. >> diag_result.txt
echo Checking Wrangler... >> diag_result.txt
wrangler --version >> diag_result.txt 2>&1
if %ERRORLEVEL% EQU 0 (echo Wrangler is available in PATH >> diag_result.txt) else (echo Wrangler NOT found in PATH. Checking %APPDATA%\npm... >> diag_result.txt)
if exist "%APPDATA%\npm\wrangler.cmd" (echo Found wrangler at %APPDATA%\npm >> diag_result.txt)

echo. >> diag_result.txt
echo Checking Current Directory... >> diag_result.txt
echo %CD% >> diag_result.txt
dir wrangler.toml >> diag_result.txt 2>&1
