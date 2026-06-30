@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "BRANCH=claude/unclear-request-9ad84a"
set "BASE=https://raw.githubusercontent.com/MIkhailNkmnme/Binary-Drum-Machine/%BRANCH%"
set "FILE=Zerkalius-genezis.html"

if not exist "archive" mkdir archive

echo ============================================
echo  Zerkalius авто-обновление (проверка 5 сек)
echo  Ветка: %BRANCH%
echo  Закрой окно чтобы остановить.
echo ============================================
echo.

REM Первая загрузка + запуск браузера
call :download
start chrome "%FILE%"

:loop
timeout /t 5 /nobreak >nul

REM Качаем свежую версию во временный файл
curl -s -L "%BASE%/%FILE%" -o "%FILE%.new"
if not exist "%FILE%.new" goto loop

REM Сравниваем с текущим
fc /b "%FILE%" "%FILE%.new" >nul 2>&1
if errorlevel 1 (
    echo [%time%] Обнаружено обновление!
    REM Старую версию в архив с меткой времени
    set "STAMP=%date:~6,4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%%time:~6,2%"
    set "STAMP=!STAMP: =0!"
    move "%FILE%" "archive\Zerkalius-genezis-!STAMP!.html" >nul
    move "%FILE%.new" "%FILE%" >nul
    REM Тянем свежий banks_data.js тоже
    curl -s -L "%BASE%/banks_data.js" -o "banks_data.js"
    echo [%time%] Обновлено. Старая версия в archive\
) else (
    del "%FILE%.new" >nul 2>&1
)
goto loop
