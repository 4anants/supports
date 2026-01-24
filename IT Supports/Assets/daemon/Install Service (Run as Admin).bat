@echo off
title Install IT Support Service
cd /d "%~dp0"
echo Installing Windows Service...
echo Using node: "%~dp0..\..\node.exe"
"%~dp0..\..\node.exe" install_service.js
pause
