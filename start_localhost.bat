@echo off
cd /d %~dp0

set "PYEXE=python"
if exist ".venv\Scripts\python.exe" set "PYEXE=.venv\Scripts\python.exe"
if exist "venv\Scripts\python.exe" set "PYEXE=venv\Scripts\python.exe"
echo Starting Aurora Checklist (localhost only)...
%PYEXE% -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
pause
