@echo off
chcp 65001 >nul
title PINTOK APTEKA — JARVIS AI (КОМПЬЮТЕР ПРОГРАММАСЫ)
echo ====================================================================
echo    PINTOK APTEKA — JARVIS AI ЖЕКЕ ЖӘРДЕМШИСИ
echo    Компьютерде ашылмақта: http://localhost:8080/jarvis.html
echo ====================================================================
start "" "http://localhost:8080/jarvis.html"
"C:\Users\user\AppData\Roaming\Antigravity\bin\agy-node.cmd" "%~dp0jarvis_server.js"
pause
