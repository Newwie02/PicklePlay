@echo off
rem ============================================================
rem  PicklePlay - bake the new logo, then start the dev server
rem  Double-click this file. Expo Go on your phone picks it up
rem  from the QR code it prints.
rem ============================================================
cd /d "%~dp0"

echo.
echo === [1/2] Baking the PicklePlay icons ===
call npm run icons
if errorlevel 1 (
  echo.
  echo Icon generation failed. If it says sharp is missing, run:  npm install
  pause
  exit /b 1
)

echo.
echo === [2/2] Starting Expo (clears cache first) ===
echo Press Ctrl+C here to stop the server.
echo.
call npx expo start -c

pause
