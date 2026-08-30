@echo off
cd /d "%~dp0"
cd server
set PRESIO_MODE=local
npm start
pause
