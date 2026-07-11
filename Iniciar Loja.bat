@echo off
title Galpao do Candido
echo.
echo  Iniciando o Galpao do Candido...
echo.

cd /d "%~dp0"
start /b cmd /c "timeout /t 3 /nobreak > NUL && start http://localhost:3000"
node server.js

pause
