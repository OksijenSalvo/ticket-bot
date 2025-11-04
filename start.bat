@echo off
CHCP 65001 > nul
cls
title blabla Bot Baslatici
:: Tüm ekranı temizle
cls

color 3
echo.
echo ╔═════════════════════════════════════════════════════════════════╗
color 0
echo ║                      blabla Botu Baslatiliyor...                ║
color 0
echo ║                      Developed By OksijenKannabis               ║
color 0
echo ╚═════════════════════════════════════════════════════════════════╝
color 0
echo.

:run
color e
echo [INFO] Bot baslatiliyor...
node index.js
color 0C
echo.
echo [HATA] Bot kapandi veya hata aldi.
echo [INFO] 10 saniye icinde yeniden baslatiliyor...
timeout /t 10 >nul
goto run
