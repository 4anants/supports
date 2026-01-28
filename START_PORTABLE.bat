@echo off
TITLE IT Support Portal
echo Starting IT Support Portal...
echo.
echo Port: 3001
echo Access via: http://localhost:3001 or http://[YOUR-IP]:3001
echo.
.\node.exe backend\dist\server.js
pause
