@echo off
title Create A-Mart Desktop Shortcut
cd /d "%~dp0"

set SCRIPT="%TEMP%\create_amart_shortcut.vbs"
set TARGET=%~dp0launch-amart.vbs
set ICON=%~dp0amart-logo.ico
set SHORTCUT=%USERPROFILE%\Desktop\A-Mart POS.lnk

echo Creating silent desktop shortcut with A-Mart logo...

echo Set oWS = WScript.CreateObject("WScript.Shell") > %SCRIPT%
echo sLinkFile = "%SHORTCUT%" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "wscript.exe" >> %SCRIPT%
echo oLink.Arguments = """%TARGET%""" >> %SCRIPT%
echo oLink.WorkingDirectory = "%~dp0" >> %SCRIPT%
echo oLink.Description = "A-Mart Supermarket Inventory and POS" >> %SCRIPT%
echo oLink.IconLocation = "%ICON%,0" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%

cscript /nologo %SCRIPT%
del %SCRIPT%

echo.
echo ==============================================================
echo  A-Mart POS shortcut created on your Windows Desktop!
echo  Icon: A-Mart Supermarket Custom Logo
echo  Mode: Silent Native Window (Zero Command Prompts/Terminals)
echo ==============================================================
echo.
pause
