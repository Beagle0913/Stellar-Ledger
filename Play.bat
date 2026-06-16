@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo   Galactic Economy
echo ========================================
echo.

if exist "release\GalacticEconomy.exe" (
  echo Launching release\GalacticEconomy.exe ...
  start "" "release\GalacticEconomy.exe"
  exit /b 0
)

echo No portable exe found at release\GalacticEconomy.exe
echo.
echo Build the game first:
echo   double-click Build Game.bat
echo.
echo Or run from source ^(requires Node.js^):
echo   npm run play
echo.
pause
exit /b 1
