@echo off
echo ===================================================
echo   Extract Mobile App - Expo / React Native Launcher
echo   Backend Server: http://10.228.155.159:8080
echo ===================================================
echo.
echo 1. Open the "Expo Go" app on your iPhone or Android phone.
echo 2. Scan the QR code that appears in this terminal.
echo 3. The native app will launch and connect over your Wi-Fi!
echo.
cd /d "%~dp0mobile_app"
call npx.cmd expo start
pause
