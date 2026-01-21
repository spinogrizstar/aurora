@echo off
cd /d %~dp0

set "PYEXE=python"
if exist ".venv\Scripts\python.exe" set "PYEXE=.venv\Scripts\python.exe"
if exist "venv\Scripts\python.exe" set "PYEXE=venv\Scripts\python.exe"
echo Starting Aurora Checklist (LAN доступ)...
echo ВНИМАНИЕ: будет доступно в домашней сети.
%PYEXE% -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
pause
