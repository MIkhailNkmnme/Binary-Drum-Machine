@echo off
rem Показывает, что за версия лежит в этой папке и не отстала ли она от GitHub.
rem Ничего не меняет - только смотрит.
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo === Zerkalius: что лежит в этой папке ===
echo.
echo Папка:
echo    %CD%
echo.

if not exist ".git" (
  echo Это не папка проекта - здесь нет репозитория.
  goto :konec
)

echo Версии в файлах:
for /f "tokens=*" %%v in ('findstr /c:"<h3>Binary Drum Machine" Zerkalius-code.html 2^>nul') do echo    %%v
for /f "tokens=*" %%v in ('findstr /c:"id=\"appTitle\"" Zerkalius-genezis.html 2^>nul') do echo    Genezis: %%v
echo.

echo Последняя правка здесь:
git log --oneline -1
echo.

echo Спрашиваю GitHub...
git -c gc.auto=0 fetch origin main 2>nul
for /f %%n in ('git rev-list --count HEAD..origin/main 2^>nul') do set OTSTAVANIE=%%n
if not defined OTSTAVANIE set OTSTAVANIE=?
echo.
if "!OTSTAVANIE!"=="0" (
  echo Свежее некуда - здесь всё последнее.
) else (
  echo Отстаёт от GitHub на !OTSTAVANIE! правок. Запустите update.bat.
)

echo.
echo Незакоммиченные изменения:
git status --short
echo    ^(пусто = ничего своего не правили^)

:konec
echo.
pause
