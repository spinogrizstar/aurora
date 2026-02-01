@echo off
setlocal

rem -------------------------------------------------
rem Конфигурация путей
rem -------------------------------------------------
set "PROJECT_DIR=D:\paket"
set "CADDY_EXE=C:\caddy\caddy.exe"
set "CADDYFILE=C:\caddy\Caddyfile"

rem -------------------------------------------------
rem Переходим в папку проекта
rem -------------------------------------------------
cd /d "%PROJECT_DIR%"

rem -------------------------------------------------
rem Выбор Python (PyCharm обычно кладёт его в .venv)
rem -------------------------------------------------
set "PYEXE=python"
if exist ".venv\Scripts\python.exe" set "PYEXE=.venv\Scripts\python.exe"
if exist "venv\Scripts\python.exe" set "PYEXE=venv\Scripts\python.exe"

echo ===============================
echo Aurora Checklist - Caddy + Host
echo ===============================
echo Project: %PROJECT_DIR%
echo Caddy:   %CADDY_EXE%
echo.

if not exist "%CADDY_EXE%" (
  echo [ERROR] Caddy не найден: %CADDY_EXE%
  echo Проверь путь к caddy.exe
  pause
  exit /b 1
)

if not exist "%CADDYFILE%" (
  echo [ERROR] Caddyfile не найден: %CADDYFILE%
  echo Проверь путь к Caddyfile
  pause
  exit /b 1
)

echo Запуск Caddy...
start "" "%CADDY_EXE%" run --config "%CADDYFILE%"

rem -------------------------------------------------
rem Проверка сайта через ~30 секунд в фоне
rem -------------------------------------------------
start /b "" cmd /c "timeout /t 30 >nul & powershell -NoProfile -Command \"try { Invoke-WebRequest -Uri 'https://cheklistbit.ru' -UseBasicParsing -TimeoutSec 10 | Out-Null; Write-Host '[OK] Сайт работает: https://cheklistbit.ru' } catch { Write-Host '[FAIL] Сайт не отвечает: https://cheklistbit.ru' }\""

echo Запуск backend на 0.0.0.0:8000 ...
%PYEXE% -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

pause
