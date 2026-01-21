@echo off
cd /d %~dp0

rem -------------------------------------------------
rem Выбор Python.
rem Если проект открывают через PyCharm, чаще всего питон лежит в .venv.
rem Чтобы .bat работали «в один клик», используем локальный python, если он есть.
rem -------------------------------------------------
set "PYEXE=python"
if exist ".venv\Scripts\python.exe" set "PYEXE=.venv\Scripts\python.exe"
if exist "venv\Scripts\python.exe" set "PYEXE=venv\Scripts\python.exe"

echo ===============================
echo Aurora Checklist - Start Menu
echo ===============================
echo 1) Localhost (only this PC)
echo 2) LAN (home network)
echo 3) Localhost + PASSWORD
echo 4) LAN + PASSWORD (recommended if you открываешь доступ наружу)
echo.
set /p choice=Choose 1-4: 
if "%choice%"=="1" goto local
if "%choice%"=="2" goto lan
if "%choice%"=="3" goto local_auth
if "%choice%"=="4" goto lan_auth
echo Unknown choice.
pause
exit /b 1
:local
%PYEXE% -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
pause
exit /b 0
:lan
%PYEXE% -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
pause
exit /b 0

:local_auth
call start_secure_localhost.bat
exit /b 0

:lan_auth
call start_secure_lan.bat
exit /b 0

:local_auth
call start_secure_localhost.bat
exit /b 0

:lan_auth
call start_secure_lan.bat
exit /b 0
