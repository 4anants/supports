@echo off
title Uninstall IT Support Service
cd /d "%~dp0"
echo Uninstalling Windows Service...
"%~dp0..\..\node.exe" uninstall_service.js
pause
