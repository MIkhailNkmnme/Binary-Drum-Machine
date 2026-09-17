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

rem A folder may carry a .git FILE instead of a folder - that is a worktree or a
rem submodule, and its link can point to a path that does not exist on this
rem machine. So we ask git itself instead of looking for the file.
set "MODE=clone"
if exist "%DIR%" (
  pushd "%DIR%"
  git rev-parse --is-inside-work-tree >nul 2>nul
  if errorlevel 1 (set "MODE=link") else (set "MODE=pull")
  popd
)

if "%MODE%"=="pull" (
  echo.
  echo === Updating %DIR% ===
  echo.
  cd "%DIR%"
  git pull origin main
) else if "%MODE%"=="link" (
  rem The folder is here but was never cloned: link it to GitHub in place.
  echo.
  echo === Folder %DIR% is not a working git clone ===
  echo Linking it to GitHub without deleting anything...
  echo.
  cd "%DIR%"
  git init
  git remote add origin "%REPO%" 2>nul
  git fetch origin main
  git checkout -B main origin/main
  if errorlevel 1 (
    echo.
    echo Could not link: local files would be overwritten by the ones from GitHub.
    echo Nothing was deleted. Rename this folder, for example to
    echo   %DIR%-old
    echo and run this file again - it will download a clean copy.
    echo.
    pause
    exit /b 1
  )
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
