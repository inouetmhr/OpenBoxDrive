"""Native messaging host for the Open Box Drive extension.

Each message is a 4-byte little-endian length followed by UTF-8 JSON.
Requests:  {"boxPath": ["All Files", "<folder>", ...]} or {"ping": true}
Responses: {"resultCode": "<code>", "path": "<path>"}; each code has a result_<code> message in _locales.
           ping answers {"resultCode": "pong", "version": HOST_VERSION, "path": <Box Drive folder>, "boxDriveFound": bool}.
Keep this format compatible: installed hosts are only replaced when the user runs the setup again.
"""
import ctypes
import json
import ntpath
import os
import struct
import subprocess
import sys
import time
import urllib.parse

# Must match LATEST_HOST_VERSION in common.js; also bump REQUIRED_HOST_VERSION there when the extension needs this version
# 3: on Windows, reuses an Explorer window that already shows the folder
HOST_VERSION = 3

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
        if sys.platform != "win32" or not show_existing_explorer(path):
            subprocess.Popen(platform["open_dir"](path))
        return {"path": path, "resultCode": "directory_opened"}
    if os.path.exists(path):
        if sys.platform != "win32" or not show_existing_explorer(os.path.dirname(path), select=path):
            subprocess.Popen(platform["reveal_file"](path))
        return {"path": path, "resultCode": "file_opened"}
    return {"path": path, "resultCode": "does_not_exist"}


# Finder reuses the window that already shows a folder, but `explorer <path>` always opens a new one.
# show_existing_explorer looks for an Explorer window showing the folder through the Shell.Application
# windows list (IShellWindows), optionally selects a file in it, and brings it to the front.
# It calls the COM methods by their vtable index, counted from the method order in the Windows SDK
# headers (ShlDisp.h, ExDisp.h, ServProv.h, ShObjIdl.h). Published COM interfaces never change that order.
CLSID_SHELL_WINDOWS = "{9BA05972-F6A8-11CF-A442-00A0C90A8F39}"
IID_ISHELL_WINDOWS = "{85CB6900-4D95-11CF-960C-0080C7F4EE85}"
IID_IWEB_BROWSER2 = "{D30C1661-CDAF-11D0-8A3E-00C04FC9E26E}"
IID_ISERVICE_PROVIDER = "{6D5140C1-7436-11CE-8034-00AA006009FA}"
IID_ISHELL_BROWSER = "{000214E2-0000-0000-C000-000000000046}"
SID_STOP_LEVEL_BROWSER = "{4C96BE40-915C-11CF-99D3-00AA004AE837}"
VTABLE_QUERY_INTERFACE = 0
VTABLE_RELEASE = 2
VTABLE_SHELL_WINDOWS_COUNT = 7
VTABLE_SHELL_WINDOWS_ITEM = 8
VTABLE_WEB_BROWSER_LOCATION_URL = 30
VTABLE_WEB_BROWSER_HWND = 37
VTABLE_SERVICE_PROVIDER_QUERY_SERVICE = 3
VTABLE_SHELL_BROWSER_QUERY_ACTIVE_SHELL_VIEW = 15
VTABLE_SHELL_VIEW_SELECT_ITEM = 14
CLSCTX_ALL = 0x17
VT_I4 = 3
SW_RESTORE = 9
# SVSI_SELECT | SVSI_DESELECTOTHERS | SVSI_ENSUREVISIBLE | SVSI_FOCUSED
SELECT_ONLY_THIS_ITEM = 0x01 | 0x04 | 0x08 | 0x10


class GUID(ctypes.Structure):
    _fields_ = [("Data1", ctypes.c_ulong), ("Data2", ctypes.c_ushort),
                ("Data3", ctypes.c_ushort), ("Data4", ctypes.c_ubyte * 8)]


class VARIANT_VALUE(ctypes.Union):
    _fields_ = [("lVal", ctypes.c_long), ("record", ctypes.c_void_p * 2)]


class VARIANT(ctypes.Structure):
    _fields_ = [("vt", ctypes.c_ushort), ("reserved", ctypes.c_ushort * 3), ("value", VARIANT_VALUE)]


OUT_POINTER = ctypes.POINTER(ctypes.c_void_p)


def guid(text):
    value = GUID()
    ctypes.oledll.ole32.CLSIDFromString(text, ctypes.byref(value))
    return value


def com_call(pointer, index, argtypes, *args):
    # Raises OSError when the method returns a failure HRESULT
    vtable = ctypes.cast(pointer, ctypes.POINTER(OUT_POINTER)).contents
    method = ctypes.WINFUNCTYPE(ctypes.HRESULT, ctypes.c_void_p, *argtypes)(vtable[index])
    return method(pointer, *args)


def com_release(pointer):
    if pointer:
        vtable = ctypes.cast(pointer, ctypes.POINTER(OUT_POINTER)).contents
        ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)(vtable[VTABLE_RELEASE])(pointer)


def query_interface(pointer, iid):
    result = ctypes.c_void_p()
    com_call(pointer, VTABLE_QUERY_INTERFACE, (ctypes.POINTER(GUID), OUT_POINTER),
             ctypes.byref(guid(iid)), ctypes.byref(result))
    return result


def explorer_url_to_path(url):
    # LocationURL looks like file:///C:/Users/me/Box/Team; special places such as "This PC" have none
    if not url.lower().startswith("file:///"):
        return None
    return ntpath.normcase(ntpath.normpath(urllib.parse.unquote(url[len("file:///"):])))


def explorer_location(browser):
    """Returns (folder, hwnd) of an Explorer window; folder is None for special places."""
    url = ctypes.c_void_p()  # BSTR
    com_call(browser, VTABLE_WEB_BROWSER_LOCATION_URL, (OUT_POINTER,), ctypes.byref(url))
    location = ctypes.wstring_at(url.value) if url.value else ""
    ctypes.windll.oleaut32.SysFreeString(url)
    hwnd = ctypes.c_void_p()
    com_call(browser, VTABLE_WEB_BROWSER_HWND, (OUT_POINTER,), ctypes.byref(hwnd))
    return explorer_url_to_path(location), hwnd.value


def select_in_explorer(browser, path):
    """Selects path, a file in the folder the window shows, as `explorer /select,` does. False on failure."""
    service_provider, shell_browser, shell_view, pidl = ctypes.c_void_p(), ctypes.c_void_p(), ctypes.c_void_p(), ctypes.c_void_p()
    try:
        service_provider = query_interface(browser, IID_ISERVICE_PROVIDER)
        com_call(service_provider, VTABLE_SERVICE_PROVIDER_QUERY_SERVICE,
                 (ctypes.POINTER(GUID), ctypes.POINTER(GUID), OUT_POINTER),
                 ctypes.byref(guid(SID_STOP_LEVEL_BROWSER)), ctypes.byref(guid(IID_ISHELL_BROWSER)),
                 ctypes.byref(shell_browser))
        com_call(shell_browser, VTABLE_SHELL_BROWSER_QUERY_ACTIVE_SHELL_VIEW, (OUT_POINTER,), ctypes.byref(shell_view))
        # The view wants the item relative to its folder: the last part of the file's absolute item ID list
        ctypes.oledll.shell32.SHParseDisplayName(path, None, ctypes.byref(pidl), 0, None)
        find_last_id = ctypes.windll.shell32.ILFindLastID
        find_last_id.argtypes = [ctypes.c_void_p]
        find_last_id.restype = ctypes.c_void_p
        com_call(shell_view, VTABLE_SHELL_VIEW_SELECT_ITEM, (ctypes.c_void_p, ctypes.c_uint),
                 find_last_id(pidl), SELECT_ONLY_THIS_ITEM)
        return True
    except OSError:
        return False
    finally:
        if pidl:
            ctypes.windll.ole32.CoTaskMemFree(pidl)
        com_release(shell_view)
        com_release(shell_browser)
        com_release(service_provider)


def bring_to_front(hwnd):
    user32 = ctypes.windll.user32
    user32.IsIconic.argtypes = [ctypes.c_void_p]
    user32.ShowWindow.argtypes = [ctypes.c_void_p, ctypes.c_int]
    user32.SetForegroundWindow.argtypes = [ctypes.c_void_p]
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, SW_RESTORE)
    return bool(user32.SetForegroundWindow(hwnd))


def show_existing_explorer(folder, select=None):
    """Brings an Explorer window already showing folder to the front, selecting the file select in it.
    False when there is no such window or anything fails, so the caller opens a new one."""
    target = ntpath.normcase(ntpath.normpath(folder))
    try:
        ole32 = ctypes.oledll.ole32
        ole32.CoInitialize(None)
    except (AttributeError, OSError):  # not Windows, or COM is unavailable on this thread
        return False
    windows = ctypes.c_void_p()
    try:
        ole32.CoCreateInstance(ctypes.byref(guid(CLSID_SHELL_WINDOWS)), None, CLSCTX_ALL,
                               ctypes.byref(guid(IID_ISHELL_WINDOWS)), ctypes.byref(windows))
        count = ctypes.c_long()
        com_call(windows, VTABLE_SHELL_WINDOWS_COUNT, (ctypes.POINTER(ctypes.c_long),), ctypes.byref(count))
        for i in range(count.value):
            window, browser = ctypes.c_void_p(), ctypes.c_void_p()
            try:
                com_call(windows, VTABLE_SHELL_WINDOWS_ITEM, (VARIANT, OUT_POINTER),
                         VARIANT(vt=VT_I4, value=VARIANT_VALUE(lVal=i)), ctypes.byref(window))
                if not window:  # S_FALSE: the window closed while we were looking
                    continue
                browser = query_interface(window, IID_IWEB_BROWSER2)
                location, hwnd = explorer_location(browser)
                if location != target or not hwnd:
                    continue
                if select and not select_in_explorer(browser, select):
                    return False
                return bring_to_front(hwnd)
            except OSError:
                continue
            finally:
                com_release(browser)
                com_release(window)
        return False
    except OSError:
        return False
    finally:
        com_release(windows)
        ole32.CoUninitialize()


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
