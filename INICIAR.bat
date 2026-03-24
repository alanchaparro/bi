@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_one_click.ps1"
if errorlevel 1 exit /b %errorlevel%
echo.
pause
