#!/bin/bash
# Run the host next to this script, whatever the browser's working directory is
exec /usr/bin/python3 "$(dirname "$0")/native-messaging-host-app.py"
