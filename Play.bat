@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo   Stellar Ledger
echo ========================================
echo.

if exist "release\StellarLedger.exe" (
  echo Launching release\StellarLedger.exe ...
  start "" "release\StellarLedger.exe"
  exit /b 0
)

if exist "release\GalacticEconomy.exe" (
  echo v0.2.0 renamed the exe to StellarLedger.exe.
  echo Run Build Game.bat or download the latest release from GitHub.
  pause
  exit /b 1
)

echo No portable exe found at release\StellarLedger.exe
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

if not exist "release\StellarLedger.exe" (
  echo Build finished but release\StellarLedger.exe was not found.
  pause
  exit /b 1
)

echo Launching release\StellarLedger.exe ...
start "" "release\StellarLedger.exe"
exit /b 0
