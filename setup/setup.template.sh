#!/bin/bash
cd "$(dirname "$0")"

EXTENTION="___APPLICATIONNAME___"

DEST_DIR="$HOME/Library/Application Support/OpenBoxDrive"
sed "s|___INSTDIR___|$DEST_DIR|" manifest-template.json > $EXTENTION.json

BROWSER="___BROWSER___"  # Filled in by the setup page: edge or chrome
if [ "$BROWSER" = "edge" ]; then
    HOSTS_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
else
    HOSTS_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
fi
# The browser does not create this folder until some native host is installed
mkdir -p "$HOSTS_DIR"
cp -f $EXTENTION.json "$HOSTS_DIR"

mkdir -p "$DEST_DIR"
cp -f native-messaging-host-app.sh "$DEST_DIR"
cp -f native-messaging-host-app.py "$DEST_DIR"
chmod +x "$DEST_DIR/native-messaging-host-app.sh"
