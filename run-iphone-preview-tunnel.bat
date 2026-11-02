@echo off
setlocal
cd /d "%~dp0"
echo Checking Node.js and npm in this Windows session...
where node >nul 2>nul
if errorlevel 1 goto NODE_MISSING
where npm >nul 2>nul
if errorlevel 1 goto NPM_MISSING
if not exist "node_modules\.bin\expo.cmd" goto EXPO_MISSING
echo.
echo Starting the app preview tunnel.
echo If Expo asks to install @expo/ngrok, answer Y.
echo When the HTTPS link appears, open it in Safari on the iPhone.
echo Keep this window open while using the preview.
echo Press Ctrl+C here when you want to stop the tunnel.
echo.
call "node_modules\.bin\expo.cmd" start --web --tunnel --port 8090
set "RUN_EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%RUN_EXIT_CODE%"=="0" echo Expo exited with code %RUN_EXIT_CODE%.
pause
exit /b %RUN_EXIT_CODE%
:NODE_MISSING
echo Node.js is not available in this Windows session.
echo Install Node.js LTS, reopen PowerShell, then run this file again.
pause
exit /b 1
:NPM_MISSING
echo npm is not available in this Windows session.
echo Install or repair Node.js LTS, reopen PowerShell, then run this file again.
pause
exit /b 1
:EXPO_MISSING
echo Expo is not installed in this project's node_modules folder.
echo Open PowerShell in this folder and run pnpm install, then run this file again.
pause
exit /b 1
