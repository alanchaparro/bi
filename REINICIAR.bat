@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\restart_stack_fresh.ps1"
if errorlevel 1 exit /b %errorlevel%
echo.
pause
