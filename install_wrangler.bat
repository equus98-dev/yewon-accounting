@echo off
set NODE_PATH=C:\Program Files\nodejs
set PATH=%NODE_PATH%;%PATH%
"%NODE_PATH%\npm.cmd" install -g wrangler 2>&1
echo EXIT_CODE=%ERRORLEVEL%
