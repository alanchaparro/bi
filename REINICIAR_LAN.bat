@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\restart_stack_fresh_lan.ps1" %*
set ERR=%ERRORLEVEL%
if %ERR% neq 0 (
  echo.
  echo REINICIAR_LAN fallo con codigo %ERR%. Revise el mensaje de PowerShell arriba.
  pause
  exit /b %ERR%
)
echo.
pause
