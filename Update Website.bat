@echo off
title HOT Creation - Update Website
cd /d "%~dp0"
echo Updating the website from the VIDEOS folder...
echo.
python tools\update_videos.py
echo.
pause
