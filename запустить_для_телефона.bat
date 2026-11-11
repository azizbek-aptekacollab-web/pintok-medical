@echo off
chcp 65001 >nul
title «Пинток Медикал» Мобиль сервер
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
