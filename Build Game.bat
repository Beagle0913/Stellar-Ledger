@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo   Building Stellar Ledger (portable)
echo ========================================
echo.

call "%~dp0scripts\bootstrap.bat"
if errorlevel 1 (
  echo.
  echo Setup failed. Run Setup.bat first or see messages above.
  pause
  exit /b 1
)

echo Building portable exe ^(about 1-2 minutes^)...
echo The script will close StellarLedger.exe if it is running.
echo.

call npm run dist
if errorlevel 1 (
  echo.
  echo ========================================
  echo   Build failed
  echo ========================================
  echo.
  echo Common fixes:
  echo   1. Close StellarLedger.exe if it is running
  echo   2. Run Setup.bat again
  echo   3. Run Build Game.bat again
  echo.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   Done!
echo.
echo   Play:  double-click Play.bat
echo   Or:    release\StellarLedger.exe
echo ========================================
echo.
pause
exit /b 0
