@echo off
echo ==========================================
echo    Building IT Support System Installer
echo ==========================================

set "ROOT_DIR=%CD%"
set "BUILD_DIR=%ROOT_DIR%\installer_build"

echo.
echo [1/5] Cleaning previous build...
if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
mkdir "%BUILD_DIR%"
mkdir "%BUILD_DIR%\api"
mkdir "%BUILD_DIR%\client"

echo.
echo [2/5] Installing Dependencies (Root & Workspaces)...
call npm install
if errorlevel 1 goto :error

echo.
echo [3/5] Building Workspaces...
call npm run build -w frontend
if errorlevel 1 goto :error
xcopy /E /I /Y "%ROOT_DIR%\frontend\dist" "%BUILD_DIR%\client"

call npm run build -w backend
if errorlevel 1 goto :error
xcopy /E /I /Y "%ROOT_DIR%\backend\dist" "%BUILD_DIR%\api\dist"
copy "%ROOT_DIR%\backend\package.json" "%BUILD_DIR%\api\"
copy "%ROOT_DIR%\backend\.env" "%BUILD_DIR%\api\.env"
xcopy /E /I /Y "%ROOT_DIR%\backend\prisma" "%BUILD_DIR%\api\prisma"

echo.
echo [4/5] Preparing Production Environment for Backend...
rem Copy node_modules from root because of workspaces hoisting
rem Ideally we should bundle or prune, but for simplicity copying all modules ensures it works.
rem A better approach for workspaces: pack the backend.
rem But 'npm install --omit=dev' inside api folder might fail if it depends on root hoisting.
rem We will try to install production deps specifically for the backend in the target folder.
cd "%BUILD_DIR%\api"
call npm install --omit=dev
if errorlevel 1 goto :error

echo [4.5/5] Bundling Node.js Executable...
copy "%ROOT_DIR%\node.exe" "%BUILD_DIR%\node.exe"

echo.
echo [5/5] Creating Start Script...
cd "%BUILD_DIR%"
(
echo @echo off
echo title IT Support System
echo echo Starting IT Support System...
echo set "PATH=%%~dp0;%%PATH%%"
echo cd api
echo echo [1/2] Checking Database...
echo call "%%~dp0node.exe" "%%~dp0api\node_modules\prisma\build\index.js" db push --accept-data-loss
echo echo [2/2] Launching Server...
echo call "%%~dp0node.exe" dist/server.js
echo pause
) > start.bat

echo.
echo ==========================================
echo    Build Complete!
echo    Output: %BUILD_DIR%
echo ==========================================
echo.
echo You can now use Inno Setup to compile this folder.
cd "%ROOT_DIR%"
exit /b 0

:error
echo.
echo !!! BUILD FAILED !!!
cd "%ROOT_DIR%"
exit /b 1
