@echo off
cd /d %~dp0

set "PYEXE=python"
if exist ".venv\Scripts\python.exe" set "PYEXE=.venv\Scripts\python.exe"
if exist "venv\Scripts\python.exe" set "PYEXE=venv\Scripts\python.exe"
echo ===============================
echo Aurora Checklist - PASSWORD MODE
echo (Localhost)
echo ===============================
set /p AURORA_USER=Login: 
set /p AURORA_PASS=Password: 
echo.
echo Starting on http://127.0.0.1:8000  (login required)
%PYEXE% -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
pause
