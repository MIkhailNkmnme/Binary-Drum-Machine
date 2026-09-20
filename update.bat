@echo off
rem One-click updater: pulls the latest changes from GitHub into this folder.
cd /d "%~dp0"
echo.
echo === Zerkalius: pulling latest from GitHub ===
echo.
rem gc.auto=0: иначе git изредка сам затевает уборку хранилища прямо посреди
rem обновления и, если какой-то файл держит антивирус или индексатор Windows,
rem останавливается на вопросе "Deletion of directory failed. Try again?".
rem Обновление в один клик не должно ничего спрашивать. Хранилище чистится
rem отдельно, файлом cleanup.bat рядом.
git -c gc.auto=0 pull origin main
if errorlevel 1 (
  echo.
  echo Pull failed. If you have local edits, run:  git stash  then run this file again.
) else (
  echo.
  echo Done. Reload the page in the browser with Ctrl+Shift+R.
)
echo.
pause
