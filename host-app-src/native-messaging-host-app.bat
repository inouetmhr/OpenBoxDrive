@echo off
rem Prefer the Python launcher: without Python installed, python.exe may be the Microsoft Store placeholder
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 "%~dp0native-messaging-host-app.py" %*
) else (
    python.exe "%~dp0native-messaging-host-app.py" %*
)
