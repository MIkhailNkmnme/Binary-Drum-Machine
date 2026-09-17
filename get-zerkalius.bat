@echo off
rem ==========================================================
rem  Zerkalius: get or update the project from GitHub.
rem  Put this file in any folder and double-click it.
rem  First run clones the repo, later runs just update it.
rem ==========================================================
setlocal
set "REPO=https://github.com/MIkhailNkmnme/Binary-Drum-Machine.git"
set "DIR=Binary-Drum-Machine"
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo Git is not installed. Get it here: https://git-scm.com/download/win
  echo Install it, then run this file again.
  echo.
  pause
  exit /b 1
)

if exist "%DIR%\.git" (
  echo.
  echo === Updating %DIR% ===
  echo.
  cd "%DIR%"
  git pull origin main
) else (
  echo.
  echo === Cloning into %DIR% ===
  echo This takes a while: the repo carries the finished videos.
  echo.
  git clone "%REPO%" "%DIR%"
  if errorlevel 1 (
    echo.
    echo Clone failed. Check the internet connection and try again.
    pause
    exit /b 1
  )
  cd "%DIR%"
)

echo.
if errorlevel 1 (
  echo Something went wrong. If you have local edits, run:  git stash
) else (
  echo Done. Folder: %CD%
  echo Opening the hub...
  start "" "index.html"
)
echo.
pause
