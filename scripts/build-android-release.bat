@echo off
echo === MeterFlo Android Release Build ===
echo.

cd /d "%~dp0.."

echo [1/4] Cleaning previous builds...
if exist "android\app\build" rmdir /s /q "android\app\build"
if exist "dist" rmdir /s /q "dist"

echo [2/4] Exporting JavaScript bundle...
call npx expo export --platform android

if errorlevel 1 (
    echo ERROR: JavaScript bundling failed!
    pause
    exit /b 1
)

echo [3/4] Copying bundle to Android assets...
if not exist "android\app\src\main\assets" mkdir "android\app\src\main\assets"
for %%f in (dist\bundles\android-*.js) do copy "%%f" "android\app\src\main\assets\index.android.bundle"
xcopy /s /y "dist\assets" "android\app\src\main\res\"

echo [4/4] Building release APK...
cd android
call gradlew.bat assembleRelease

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
