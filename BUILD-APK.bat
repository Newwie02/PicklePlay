@echo off
rem ============================================================
rem  PicklePlay - build an installable Android APK with EAS
rem  Double-click this file. It uploads to Expo's servers and
rem  prints a download link when it finishes (5-20 min).
rem ============================================================
cd /d "%~dp0"

echo.
echo === Building the Android APK (preview profile) ===
echo You may be asked to log in to your Expo account (izza817).
echo.
call npx eas-cli@latest build --profile preview --platform android

echo.
pause
