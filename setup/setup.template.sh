#!/bin/bash
cd "$(dirname "$0")"

EXTENTION="___APPLICATIONNAME___"

DEST_DIR="$HOME/Library/Application Support/OpenBoxDrive"
sed "s|___INSTDIR___|$DEST_DIR|" manifest-template.json > $EXTENTION.json

BROWSER="___BROWSER___"  # Replace ___BROWSER___ with the desired browser name; for example: edge or chrome.
if [ "$BROWSER" = "edge" ]; then
    cp -f $EXTENTION.json "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
else
    cp -f $EXTENTION.json "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
fi

mkdir -p "$DEST_DIR"
cp -f native-messaging-host-app.sh "$DEST_DIR"
cp -f native-messaging-host-app.py "$DEST_DIR"
chmod +x "$DEST_DIR/native-messaging-host-app.sh"
