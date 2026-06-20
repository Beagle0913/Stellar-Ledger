@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo   Stellar Ledger - Setup
echo ========================================
echo.

call "%~dp0scripts\bootstrap.bat"
if errorlevel 1 (
  echo.
  echo Setup failed. See messages above.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   Setup complete!
echo.
echo   Build:  double-click Build Game.bat
echo   Play:   double-click Play.bat
echo ========================================
echo.
pause
exit /b 0
