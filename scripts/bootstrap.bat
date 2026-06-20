@echo off
REM Resolve Node (bootstrap via PowerShell if needed) and install deps.
REM Sets NODE_EXE and prepends Node to PATH for the caller.
REM Usage: call "%~dp0bootstrap.bat"
setlocal EnableExtensions
set "BOOTSTRAP_DIR=%~dp0"
set "NODE_EXE="
set "NODE_DIR="

powershell -NoProfile -ExecutionPolicy Bypass -File "%BOOTSTRAP_DIR%ensure-node.ps1"
if errorlevel 1 (
  if exist "%BOOTSTRAP_DIR%.node-path.txt" type "%BOOTSTRAP_DIR%.node-path.txt"
  endlocal & exit /b 1
)

set /p NODE_EXE=<"%BOOTSTRAP_DIR%.node-path.txt"
if not exist "%NODE_EXE%" (
  echo ERROR: Node path not found: %NODE_EXE%
  endlocal & exit /b 1
)

for %%D in ("%NODE_EXE%") do set "NODE_DIR=%%~dpD"

"%NODE_EXE%" "%BOOTSTRAP_DIR%ensure-deps.mjs"
if errorlevel 1 (
  endlocal & exit /b 1
)

endlocal & set "NODE_EXE=%NODE_EXE%" & set "NODE_DIR=%NODE_DIR%" & set "PATH=%NODE_DIR%;%PATH%" & exit /b 0
