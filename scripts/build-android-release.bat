@echo off
echo === MeterFlo Android Release Build ===
echo.

cd /d "%~dp0.."

echo [1/5] Cleaning previous builds...
if exist "android\app\build" rmdir /s /q "android\app\build"
if exist "android\app\src\main\assets\index.android.bundle" del "android\app\src\main\assets\index.android.bundle"

echo [2/5] Creating assets directory...
if not exist "android\app\src\main\assets" mkdir "android\app\src\main\assets"

echo [3/5] Bundling JavaScript...
call npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android\app\src\main\assets\index.android.bundle --assets-dest android\app\src\main\res

if errorlevel 1 (
    echo ERROR: JavaScript bundling failed!
    pause
    exit /b 1
)

echo [4/5] Building release APK...
cd android
call gradlew.bat assembleRelease

if errorlevel 1 (
    echo ERROR: APK build failed!
    pause
    exit /b 1
)

echo.
echo [5/5] Build complete!
echo.
echo APK location:
echo   android\app\build\outputs\apk\release\app-release.apk
echo.
pause
