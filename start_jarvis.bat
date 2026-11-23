@echo off
title PINTOK APTEKA — JARVIS AI SERVER
echo ====================================================================
echo    PINTOK APTEKA — JARVIS AI ЖӘРДЕМШИ СЕРВЕРИ
echo    Браузерде ашыў: http://localhost:8080/jarvis.html
echo ====================================================================
start "" "http://localhost:8080/jarvis.html"
"C:\Users\user\AppData\Roaming\Antigravity\bin\agy-node.cmd" "%~dp0start_all.js"
pause
