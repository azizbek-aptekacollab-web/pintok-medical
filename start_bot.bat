@echo off
title PINTOK APTEKA — BOTS (@apteka_kontroll_bot + @apteka_uprav_bot)
echo ====================================================================
echo    PINTOK APTEKA — ЕКИ БОТ ТА ИСЛЕП ТУР:
echo    1) Фармацевтлер боты: @apteka_kontroll_bot
echo    2) Басшы (Управляющий) боты: @apteka_uprav_bot
echo ====================================================================
start "PINTOK ADMIN BOT (@apteka_uprav_bot)" "C:\Users\user\AppData\Roaming\Antigravity\bin\agy-node.cmd" "%~dp0admin_bot.js"
"C:\Users\user\AppData\Roaming\Antigravity\bin\agy-node.cmd" "%~dp0bot.js"
pause
