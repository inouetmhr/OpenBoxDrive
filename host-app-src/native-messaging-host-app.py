"""Native messaging host for the Open Box Drive extension.

Each message is a 4-byte little-endian length followed by UTF-8 JSON.
Requests:  {"boxPath": ["All Files", "<folder>", ...]} or {"ping": true}
Responses: {"resultCode": "<code>", "path": "<path>"}; each code has a result_<code> message in _locales.
           ping answers {"resultCode": "pong", "version": HOST_VERSION, "path": <Box Drive folder>, "boxDriveFound": bool}.
Keep this format compatible: installed hosts are only replaced when the user runs the setup again.
"""
import json
import os
import struct
import subprocess
import sys
import time

# Bump when the extension needs a newer host; must match REQUIRED_HOST_VERSION in common.js
HOST_VERSION = 2

# Box Drive folder under the home directory and the commands to show a folder / select a file
PLATFORMS = {
    "darwin": {
        "box_root": ("Library", "CloudStorage", "Box-Box"),
        "open_dir": lambda path: ["open", path],
        "reveal_file": lambda path: ["open", "-R", path],
    },
    "win32": {
        "box_root": ("Box",),
        "open_dir": lambda path: ["explorer", path],
        "reveal_file": lambda path: ["explorer", "/select,", path],
    },
}

# Box Drive may not have synced a newly created item yet
WAIT_ATTEMPTS = 10
WAIT_INTERVAL_SECONDS = 0.5


def current_platform():
    return PLATFORMS.get(sys.platform)


def open_path(path):
    path = path.rstrip(os.sep)
    platform = current_platform()
    if platform is None:
        return {"path": path, "resultCode": "unsupported_platform"}
    if os.path.isdir(path):
        subprocess.Popen(platform["open_dir"](path))
        return {"path": path, "resultCode": "directory_opened"}
    if os.path.exists(path):
        subprocess.Popen(platform["reveal_file"](path))
        return {"path": path, "resultCode": "file_opened"}
    return {"path": path, "resultCode": "does_not_exist"}


def wait_for_path(path):
    for attempt in range(WAIT_ATTEMPTS):
        if os.path.exists(path):
            return True
        if attempt < WAIT_ATTEMPTS - 1:
            time.sleep(WAIT_INTERVAL_SECONDS)
    return False


def box_drive_root(platform):
    return os.path.join(os.path.expanduser("~"), *platform["box_root"])


def open_box_path(box_path):
    platform = current_platform()
    if platform is None:
        return {"path": "/".join(box_path), "resultCode": "unsupported_platform"}
    # box_path starts with the Box root folder ("All Files"), which is the Box Drive folder itself
    path = os.path.join(box_drive_root(platform), *box_path[1:])
    wait_for_path(path)
    return open_path(path)


def ping():
    platform = current_platform()
    if platform is None:
        return {"path": "", "resultCode": "unsupported_platform", "version": HOST_VERSION}
    root = box_drive_root(platform)
    return {"path": root, "resultCode": "pong", "version": HOST_VERSION, "boxDriveFound": os.path.isdir(root)}


def handle(request):
    if request.get("ping"):
        return ping()
    if "boxPath" in request:
        return open_box_path(request["boxPath"])
    return {"path": "", "resultCode": "bad_request"}


def read_message(stdin):
    header = stdin.read(4)
    if len(header) != 4:
        return None
    (length,) = struct.unpack("<I", header)
    body = stdin.read(length)
    if len(body) != length:
        return None
    try:
        request = json.loads(body.decode("utf-8"))
    except ValueError:
        return None
    return request if isinstance(request, dict) else None


def write_message(stdout, message):
    body = json.dumps(message).encode("utf-8")
    stdout.write(struct.pack("<I", len(body)))
    stdout.write(body)
    stdout.flush()


def main(stdin, stdout):
    request = read_message(stdin)
    if request is None:
        return 1
    write_message(stdout, handle(request))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.stdin.buffer, sys.stdout.buffer))
