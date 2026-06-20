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
set /p BUILD_NOW="Build now? This runs Setup + dist ^(Y/N^): "
if /I not "%BUILD_NOW%"=="Y" (
  echo.
  echo Download a release build from GitHub, or run Build Game.bat.
  pause
  exit /b 1
)

echo.
call "%~dp0scripts\bootstrap.bat"
if errorlevel 1 (
  echo.
  echo Setup failed. See messages above.
  pause
  exit /b 1
)

echo Building portable exe ^(about 1-2 minutes^)...
call npm run dist
if errorlevel 1 (
  echo.
  echo Build failed. See messages above.
  pause
  exit /b 1
)

if not exist "release\GalacticEconomy.exe" (
  echo Build finished but release\GalacticEconomy.exe was not found.
  pause
  exit /b 1
)

echo Launching release\GalacticEconomy.exe ...
start "" "release\GalacticEconomy.exe"
exit /b 0
