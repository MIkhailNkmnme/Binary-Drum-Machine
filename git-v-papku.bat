@echo off
rem Переносит каталог истории git внутрь рабочей папки.
rem
rem Было: файлы в D:\GD\_pzl\Zerkulis\Binary-Drum-Machine, а история отдельно,
rem в D:\_pzlgit\Binary-Drum-Machine.git. Рядом с файлами при такой раскладке
rem лежит не папка .git, а файл .git с путём внутри.
rem Станет: обычная скрытая папка .git рядом с файлами, и проект переезжает
rem на другой диск одной папкой.
rem
rem Ничего не удаляется: каталог истории именно перемещается.
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo === Zerkalius: история git переезжает в рабочую папку ===
echo.

if not exist ".git" (
  echo Здесь нет репозитория. Запускать надо из папки с файлами проекта.
  goto :konec
)
if exist ".git\" (
  echo История уже лежит внутри папки. Переносить нечего.
  goto :konec
)

rem .git оказался файлом - читаем из него путь к каталогу истории
set "GITDIR="
for /f "tokens=1,* delims= " %%a in (.git) do if /i "%%a"=="gitdir:" set "GITDIR=%%b"
if not defined GITDIR (
  echo Не смог прочитать путь из файла .git. Покажите мне его содержимое:
  type .git
  goto :konec
)
if not exist "!GITDIR!\HEAD" (
  echo По пути !GITDIR! репозитория нет.
  goto :konec
)
echo История сейчас здесь: !GITDIR!

rem Несохранённые правки переносить опасно - сначала пусть человек их разберёт
git diff --quiet && git diff --cached --quiet
if errorlevel 1 (
  echo.
  echo В папке есть несохранённые изменения:
  git status --short
  echo.
  echo Сначала закоммитьте их или отмените, потом запускайте этот файл.
  goto :konec
)

echo.
echo Закройте редакторы, проводник и браузер с этой папкой:
echo занятый файл Windows перенести не даст.
pause

move "!GITDIR!" ".git_perenos" >nul
if errorlevel 1 (
  echo.
  echo Перенос не удался - файлы кем-то заняты. Закройте всё и попробуйте снова.
  goto :konec
)
del ".git"
ren ".git_perenos" ".git"

rem При такой раскладке в настройках может быть прописан путь к рабочей папке.
rem Теперь он не нужен и только мешает: снимаем, если был.
git config --unset core.worktree 2>nul

echo.
echo === Проверка ===
git status --short
git log --oneline -1
echo.
if exist ".git\HEAD" (
  echo Готово. История теперь внутри папки, старый каталог можно не искать.
) else (
  echo Что-то пошло не так - покажите мне вывод целиком.
)

:konec
echo.
pause
