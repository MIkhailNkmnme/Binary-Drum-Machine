@echo off
rem One-click updater: pulls the latest changes from GitHub into this folder.
cd /d "%~dp0"
echo.
echo === Zerkalius: pulling latest from GitHub ===
echo.
git pull origin main
if errorlevel 1 (
  echo.
  echo Pull failed. If you have local edits, run:  git stash  then run this file again.
) else (
  echo.
  echo Done. Reload the page in the browser with Ctrl+Shift+R.
)
echo.
pause
