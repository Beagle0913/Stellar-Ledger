@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo   Building Galactic Economy (portable)
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not on PATH.
  echo Install Node.js 22+ from https://nodejs.org/ then run this again.
  echo.
  pause
  exit /b 1
)

REM npm works everywhere; use pnpm only when already on PATH.
set "PKG_RUN=call npm run"
set "PKG_INSTALL=call npm install"
where pnpm >nul 2>&1 (
  set "PKG_RUN=call pnpm run"
  set "PKG_INSTALL=call pnpm install"
)

if not exist "node_modules\" (
  echo Installing dependencies ^(first time only^)...
  %PKG_INSTALL%
  if errorlevel 1 (
    echo.
    echo Install failed. See messages above.
    pause
    exit /b 1
  )
  echo.
)

echo Building portable exe ^(about 1-2 minutes^)...
echo The script will close GalacticEconomy.exe if it is running.
echo.
%PKG_RUN% dist
if errorlevel 1 (
  echo.
  echo ========================================
  echo   Build failed
  echo ========================================
  echo.
  echo Common fixes:
  echo   1. Close GalacticEconomy.exe if it is running
  echo   2. Run: npm run rebuild:electron
  echo   3. Run Build Game.bat again
  echo.
  echo If you see NODE_MODULE_VERSION 127 vs 130:
  echo   better-sqlite3 was built for Node, not Electron.
  echo   Build Game.bat runs the full dist pipeline to fix this.
  echo.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   Done!
echo.
echo   Play:  double-click Play.bat
echo   Or:    release\GalacticEconomy.exe
echo ========================================
echo.
pause
