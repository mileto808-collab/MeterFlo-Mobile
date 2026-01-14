@echo off
echo === MeterFlo Android Release Build ===
echo.

cd /d "%~dp0.."

echo [1/2] Cleaning previous builds...
if exist "android\app\build" rmdir /s /q "android\app\build"

echo [2/2] Building release APK...
call npx expo run:android --variant release

if errorlevel 1 (
    echo ERROR: APK build failed!
    pause
    exit /b 1
)

echo.
echo Build complete!
echo.
echo APK location:
echo   android\app\build\outputs\apk\release\app-release.apk
echo.
pause
