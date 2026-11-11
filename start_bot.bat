@echo off
title PINTOK APTEKA — BOTS (@apekaaabot + @apteka_kontrol_bot)
echo ====================================================================
echo    PINTOK APTEKA — ЕКИ БОТ ТА ИСЛЕП ТУР:
echo    1) Хызметкерлер боты: @apekaaabot
echo    2) Басшы (Контроль) боты: @apteka_kontrol_bot
echo ====================================================================
start "PINTOK ADMIN BOT (@apteka_kontrol_bot)" "C:\Users\user\AppData\Roaming\Antigravity\bin\agy-node.cmd" "%~dp0admin_bot.js"
"C:\Users\user\AppData\Roaming\Antigravity\bin\agy-node.cmd" "%~dp0bot.js"
pause
