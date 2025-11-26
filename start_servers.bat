@echo off
echo Starting Quiz The Spire Application...
echo.

echo Starting backend server...
start "Backend Server" cmd /k "cd /d %~dp0backend && python app.py"

timeout /t 5 /nobreak > nul

echo Starting HTTPS proxy server...
start "HTTPS Proxy" cmd /k "cd /d %~dp0backend && node proxy.js"

echo.
echo Servers started!
echo - Backend: http://localhost:8000
echo - Frontend/Proxy: https://localhost
echo.
echo Press any key to close this window...
pause > nul