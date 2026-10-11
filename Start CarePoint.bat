@echo off
setlocal
cd /d "%~dp0"
set "NODE_EXE="
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_EXE for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE (
  echo Node.js 24 or newer was not found.
  echo Install Node.js, then double-click this file again.
  pause
  exit /b 1
)
start "CarePoint server" /min "%NODE_EXE%" server.js
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3000"
endlocal
