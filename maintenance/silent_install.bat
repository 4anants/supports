@echo off
cd /d "%~dp0\.."

set "LOGFILE=%CD%\install_debug.log"
echo [Install] %DATE% %TIME% > "%LOGFILE%"
echo Working Directory: %CD% >> "%LOGFILE%"

if not exist "node.exe" goto NODE_MISSING
if not exist "node_modules" goto MODULES_MISSING

echo [OK] Running database migrations... >> "%LOGFILE%"
.\node.exe "node_modules\prisma\build\index.js" migrate deploy --schema=prisma\schema.prisma >> "%LOGFILE%" 2>&1

echo [OK] Running service installation... >> "%LOGFILE%"
.\node.exe "maintenance\install_service.cjs" >> "%LOGFILE%" 2>&1
exit /b 0

:NODE_MISSING
echo [ERROR] node.exe not found >> "%LOGFILE%"
exit /b 1

:MODULES_MISSING
echo [ERROR] node_modules not found >> "%LOGFILE%"
exit /b 1
