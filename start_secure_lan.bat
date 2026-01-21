@echo off
cd /d %~dp0

set "PYEXE=python"
if exist ".venv\Scripts\python.exe" set "PYEXE=.venv\Scripts\python.exe"
if exist "venv\Scripts\python.exe" set "PYEXE=venv\Scripts\python.exe"
echo ===============================
echo Aurora Checklist - PASSWORD MODE
echo (LAN)
echo ===============================
set /p AURORA_USER=Login: 
set /p AURORA_PASS=Password: 
echo.
echo Starting on http://0.0.0.0:8000  (login required)
echo Use your PC LAN IP, e.g. http://192.168.1.50:8000
%PYEXE% -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
pause
