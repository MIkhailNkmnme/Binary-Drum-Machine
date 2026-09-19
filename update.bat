@echo off
rem Обновление в один клик: тянет свежее с GitHub в эту папку.
rem
rem Почему сначала копия во временной папке: cmd читает .bat прямо с диска по
rem ходу выполнения, запоминая смещение в байтах. Обновление заменяет этот же
rem файл, и cmd продолжает читать уже новый - со старого места, посреди строки.
rem Тогда "git" превращается в "it", а следом выполняется случайный обрывок.
rem Из временной копии обновлять себя безопасно.
if /i "%~1"=="izkopii" goto :rabota
copy /y "%~f0" "%TEMP%\zerk-update.bat" >nul
if errorlevel 1 (
  echo Не смог сделать временную копию. Обновляю как есть.
  goto :rabota
)
"%TEMP%\zerk-update.bat" izkopii "%~dp0."
exit /b

:rabota
if /i "%~1"=="izkopii" (cd /d "%~2") else (cd /d "%~dp0")

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
  echo Обновиться не вышло.
  echo Если ругается на свои правки - сохраните их:  git stash
  echo Если на лишний файл - удалите его:  del имя-файла
  echo Потом запустите этот файл снова.
) else (
  echo.
  echo Готово. Перезагрузите страницу в браузере: Ctrl+Shift+R.
)
echo.
pause
