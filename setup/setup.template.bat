@echo off
set "BROWSER=___BROWSER___"

if "%BROWSER%"=="edge" (
    set "REG_BROWSER=Microsoft\Edge"
) else (
    set "REG_BROWSER=Google\Chrome"
)

set "REGISTRY_KEY_PATH=Software\%REG_BROWSER%\NativeMessagingHosts\com.github.inouetmhr.open_box_drive"
set "DEST_DIR=%LOCALAPPDATA%\OpenBoxDrive\NativeHost"

if not exist "%DEST_DIR%"   mkdir "%DEST_DIR%"
@echo on
copy /Y native-messaging-host-app.bat "%DEST_DIR%"
copy /Y native-messaging-host-app.py "%DEST_DIR%"
copy /Y manifest-template.json "%DEST_DIR%\%BROWSER%-manifest.json"
reg add "HKCU\%REGISTRY_KEY_PATH%" /ve /d "%DEST_DIR%\%BROWSER%-manifest.json" /f