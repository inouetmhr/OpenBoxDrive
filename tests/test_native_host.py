import importlib.util
import io
import json
import os
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HOST_DIR = Path(__file__).resolve().parent.parent / "host-app-src"
HOST_PATH = HOST_DIR / "native-messaging-host-app.py"
LOCALES_DIR = Path(__file__).resolve().parent.parent / "_locales"

spec = importlib.util.spec_from_file_location("native_host", HOST_PATH)
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)


def frame(message):
    body = json.dumps(message).encode("utf-8")
    return struct.pack("<I", len(body)) + body


def unframe(data):
    length = struct.unpack("<I", data[:4])[0]
    return json.loads(data[4:4 + length].decode("utf-8"))


class TempDirTestCase(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = tmp.name
        self.popen = self.patch(host.subprocess, "Popen")

    def patch(self, target, attribute, *args, **kwargs):
        patcher = mock.patch.object(target, attribute, *args, **kwargs)
        self.addCleanup(patcher.stop)
        return patcher.start()


class OpenPathTest(TempDirTestCase):
    def setUp(self):
        super().setUp()
        self.file = os.path.join(self.dir, "a.txt")
        Path(self.file).write_text("x")

    def test_directory_on_mac(self):
        self.patch(sys, "platform", "darwin")
        result = host.open_path(self.dir + os.sep)
        self.popen.assert_called_once_with(["open", self.dir])
        self.assertEqual(result, {"path": self.dir, "resultCode": "directory_opened"})

    def test_directory_on_windows(self):
        self.patch(sys, "platform", "win32")
        host.open_path(self.dir)
        self.popen.assert_called_once_with(["explorer", self.dir])

    def test_file_on_mac_reveals_in_finder(self):
        self.patch(sys, "platform", "darwin")
        result = host.open_path(self.file)
        self.popen.assert_called_once_with(["open", "-R", self.file])
        self.assertEqual(result, {"path": self.file, "resultCode": "file_opened"})

    def test_file_on_windows_selects_in_explorer(self):
        self.patch(sys, "platform", "win32")
        host.open_path(self.file)
        self.popen.assert_called_once_with(["explorer", "/select,", self.file])

    def test_missing_path(self):
        missing = os.path.join(self.dir, "missing")
        result = host.open_path(missing)
        self.popen.assert_not_called()
        self.assertEqual(result, {"path": missing, "resultCode": "does_not_exist"})

    def test_unsupported_platform_opens_nothing(self):
        self.patch(sys, "platform", "linux")
        result = host.open_path(self.dir)
        self.popen.assert_not_called()
        self.assertEqual(result["resultCode"], "unsupported_platform")


class OpenBoxPathTest(TempDirTestCase):
    def setUp(self):
        super().setUp()
        self.patch(host.os.path, "expanduser", return_value=self.dir)
        self.sleep = self.patch(host.time, "sleep")

    def test_mac_path_skips_root_folder(self):
        self.patch(sys, "platform", "darwin")
        target = Path(self.dir, "Library", "CloudStorage", "Box-Box", "Team", "Docs")
        target.mkdir(parents=True)
        result = host.open_box_path(["All Files", "Team", "Docs"])
        self.assertEqual(result, {"path": str(target), "resultCode": "directory_opened"})
        self.sleep.assert_not_called()

    def test_windows_path(self):
        self.patch(sys, "platform", "win32")
        target = Path(self.dir, "Box", "Team")
        target.mkdir(parents=True)
        result = host.open_box_path(["All Files", "Team"])
        self.assertEqual(result["path"], str(target))

    def test_root_folder_opens_box_drive_itself(self):
        self.patch(sys, "platform", "win32")
        Path(self.dir, "Box").mkdir()
        result = host.open_box_path(["All Files"])
        self.assertEqual(result["path"], os.path.join(self.dir, "Box"))

    def test_retries_until_sync_then_gives_up(self):
        self.patch(sys, "platform", "win32")
        result = host.open_box_path(["All Files", "NotSynced"])
        self.assertEqual(self.sleep.call_count, host.WAIT_ATTEMPTS - 1)
        self.assertEqual(result, {"path": os.path.join(self.dir, "Box", "NotSynced"), "resultCode": "does_not_exist"})

    def test_empty_path_does_not_crash(self):
        self.patch(sys, "platform", "win32")
        result = host.open_box_path([])
        self.assertEqual(result["path"], os.path.join(self.dir, "Box"))

    def test_unsupported_platform(self):
        self.patch(sys, "platform", "linux")
        result = host.open_box_path(["All Files", "Team"])
        self.assertEqual(result["resultCode"], "unsupported_platform")
        self.sleep.assert_not_called()


class PingTest(TempDirTestCase):
    def setUp(self):
        super().setUp()
        self.patch(host.os.path, "expanduser", return_value=self.dir)

    def test_reports_version_and_box_drive_folder(self):
        self.patch(sys, "platform", "darwin")
        root = Path(self.dir, "Library", "CloudStorage", "Box-Box")
        root.mkdir(parents=True)
        self.assertEqual(host.handle({"ping": True}), {
            "path": str(root), "resultCode": "pong", "version": host.HOST_VERSION, "boxDriveFound": True,
        })
        self.popen.assert_not_called()

    def test_reports_missing_box_drive(self):
        self.patch(sys, "platform", "win32")
        result = host.handle({"ping": True})
        self.assertEqual(result["path"], os.path.join(self.dir, "Box"))
        self.assertFalse(result["boxDriveFound"])

    def test_unsupported_platform(self):
        self.patch(sys, "platform", "linux")
        self.assertEqual(host.handle({"ping": True})["resultCode"], "unsupported_platform")

    def test_version_matches_the_extension(self):
        common_js = (HOST_DIR.parent / "common.js").read_text(encoding="utf-8")
        self.assertIn(f"const REQUIRED_HOST_VERSION = {host.HOST_VERSION};", common_js)


class MainTest(unittest.TestCase):
    def run_main(self, data):
        stdout = io.BytesIO()
        code = host.main(io.BytesIO(data), stdout)
        return code, stdout.getvalue()

    def test_dispatches_request_and_writes_framed_response(self):
        with mock.patch.object(host, "open_box_path", return_value={"path": "あ", "resultCode": "file_opened"}) as open_box_path:
            code, out = self.run_main(frame({"boxPath": ["All Files", "あ"]}))
        open_box_path.assert_called_once_with(["All Files", "あ"])
        self.assertEqual(code, 0)
        self.assertEqual(unframe(out), {"path": "あ", "resultCode": "file_opened"})

    def test_local_paths_are_not_opened(self):
        with mock.patch.object(host, "open_path") as open_path:
            code, out = self.run_main(frame({"filePath": "C:\\Windows"}))
        open_path.assert_not_called()
        self.assertEqual(unframe(out)["resultCode"], "bad_request")

    def test_unknown_request(self):
        code, out = self.run_main(frame({"something": 1}))
        self.assertEqual(code, 0)
        self.assertEqual(unframe(out)["resultCode"], "bad_request")

    def test_empty_input(self):
        self.assertEqual(self.run_main(b""), (1, b""))

    def test_malformed_json(self):
        body = b"{not json"
        self.assertEqual(self.run_main(struct.pack("<I", len(body)) + body), (1, b""))

    def test_empty_box_path_opens_box_drive_root(self):
        with mock.patch.object(host, "open_box_path", return_value={"path": "", "resultCode": "does_not_exist"}) as open_box_path:
            code, _ = self.run_main(frame({"boxPath": []}))
        open_box_path.assert_called_once_with([])
        self.assertEqual(code, 0)

    def test_truncated_body(self):
        self.assertEqual(self.run_main(struct.pack("<I", 100) + b"{}"), (1, b""))


class ResultCodeMessagesTest(unittest.TestCase):
    def test_every_result_code_has_a_message(self):
        codes = {"directory_opened", "file_opened", "does_not_exist", "unsupported_platform", "bad_request"}
        source = HOST_PATH.read_text(encoding="utf-8")
        for code in codes:
            self.assertIn(f'"{code}"', source)
        for locale in ("en", "ja"):
            messages = json.loads((LOCALES_DIR / locale / "messages.json").read_text(encoding="utf-8"))
            for code in codes:
                self.assertIn(f"result_{code}", messages, f"{locale}: result_{code}")


@unittest.skipUnless(sys.platform == "darwin", "the shell launcher runs /usr/bin/python3 on macOS")
class LauncherTest(unittest.TestCase):
    def test_shell_launcher_works_from_another_directory(self):
        with tempfile.TemporaryDirectory() as cwd:
            proc = subprocess.run(
                ["/bin/bash", str(HOST_DIR / "native-messaging-host-app.sh")],
                input=frame({"ping": True}),
                capture_output=True,
                cwd=cwd,
                timeout=10,
                check=True,
                env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
            )
        self.assertEqual(unframe(proc.stdout)["resultCode"], "pong")


class StdioProtocolTest(unittest.TestCase):
    def test_round_trip_for_ping(self):
        proc = subprocess.run(
            [sys.executable, "-B", str(HOST_PATH)],
            input=frame({"ping": True}),
            capture_output=True,
            timeout=10,
            check=True,
        )
        self.assertEqual(unframe(proc.stdout)["version"], host.HOST_VERSION)


if __name__ == "__main__":
    unittest.main()
