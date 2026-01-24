@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM Ensure node.exe is present in Root (two levels up)
if not exist "..\..\node.exe" exit /b 1

REM Run the installer
"..\..\node.exe" install_service.js

exit /b 0
