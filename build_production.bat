@echo off
echo ===================================================
echo   IT Supports - Production Build ^& Staging
echo ===================================================

REM 1. Clean previous build
if exist "release_staging" (
    echo [1/6] Cleaning previous build...
    rmdir /s /q release_staging
)
mkdir release_staging

REM 2. Build Frontend and Backend
echo [2/6] Building Frontend ^& Backend...
call npm run build

REM 3. Prepare Directories
echo [3/6] Preparing Release Directories...
mkdir release_staging\backend\dist
mkdir release_staging\prisma
mkdir release_staging\frontend\dist
mkdir release_staging\maintenance
mkdir release_staging\uploads
mkdir release_staging\backups
mkdir release_staging\logs

REM 4. Copying Files
echo [4/6] Copying Files...

REM Copy Frontend Build
xcopy /E /I /Y "frontend\dist" "release_staging\frontend\dist"

REM Copy Backend Build
xcopy /E /I /Y "backend\dist" "release_staging\backend\dist"
copy "backend\prisma\schema.prisma" "release_staging\prisma\"
if exist "backend\prisma\migrations" xcopy /E /I /Y "backend\prisma\migrations" "release_staging\prisma\migrations"
if exist "backend\prisma\dev.db" copy "backend\prisma\dev.db" "release_staging\dev.db"

REM Copy Maintenance Scripts
xcopy /E /I /Y "maintenance" "release_staging\maintenance"

REM Copy Root Files (CRITICAL: package.json at root)
copy "release_runner.cjs" "release_staging\"
copy "backend\package.json" "release_staging\"
copy "backend\.env" "release_staging\backend\.env"
copy "node.exe" "release_staging\"

REM 5. Installing Production Dependencies (AT ROOT)
echo [5/6] Installing Production Dependencies at ROOT...
cd release_staging
call npm install --omit=dev --no-save
cd ..

REM 6. Compile Installer (If Inno Setup is found)
echo [6/6] Compiling Installer...
if not exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" goto NO_ISCC

"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" "setup.iss"
if %ERRORLEVEL% EQU 0 goto COMPILE_SUCCESS

echo.
echo [ERROR] Inno Setup compilation failed.
goto SUMMARY

:COMPILE_SUCCESS
echo.
echo [SUCCESS] Installer generated in Output directory.
goto SUMMARY

:NO_ISCC
echo [SKIP] Inno Setup compiler (ISCC.exe) not found at standard path.
echo Please compile "setup.iss" manually.

:SUMMARY
REM 7. Summary
echo ===================================================
echo   Build Staging Complete!
echo   Location: %~dp0release_staging
echo.
if exist "Output\ITSupportsSetup.exe" (
    echo   Installer: %~dp0Output\ITSupportsSetup.exe
)
echo ===================================================
