@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_lan.ps1"
if errorlevel 1 exit /b %errorlevel%
echo.
pause
