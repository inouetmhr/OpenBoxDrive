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

HOST_PATH = Path(__file__).resolve().parent.parent / "host-app-src" / "native-messaging-host-app.py"

spec = importlib.util.spec_from_file_location("native_host", HOST_PATH)
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)


def frame(message):
    body = json.dumps(message).encode("utf-8")
    return struct.pack("<I", len(body)) + body


def unframe(data):
    length = struct.unpack("<I", data[:4])[0]
    return json.loads(data[4:4 + length].decode("utf-8"))


class SendTest(unittest.TestCase):
    def test_writes_length_prefixed_utf8_json(self):
        stdout = mock.Mock(buffer=io.BytesIO())
        with mock.patch.object(sys, "stdout", stdout):
            host.send({"path": "あ", "resultCode": "file_opened"})
        self.assertEqual(unframe(stdout.buffer.getvalue()), {"path": "あ", "resultCode": "file_opened"})


class OpenByShellTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = self.tmp.name
        self.file = os.path.join(self.dir, "a.txt")
        Path(self.file).write_text("x")
        self.sent = []
        patcher = mock.patch.object(host, "send", self.sent.append)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_directory_on_mac(self):
        with mock.patch.object(sys, "platform", "darwin"), mock.patch.object(host.subprocess, "run") as run:
            host.open_by_shell(self.dir + os.sep)
        run.assert_called_once_with(["open", self.dir])
        self.assertEqual(self.sent, [{"path": self.dir, "resultCode": "directory_opened"}])

    def test_directory_on_windows(self):
        with mock.patch.object(sys, "platform", "win32"), mock.patch.object(host.subprocess, "run") as run:
            host.open_by_shell(self.dir)
        run.assert_called_once_with(["explorer", self.dir])

    def test_file_on_mac_reveals_in_finder(self):
        with mock.patch.object(sys, "platform", "darwin"), mock.patch.object(host.subprocess, "run") as run:
            host.open_by_shell(self.file)
        run.assert_called_once_with(["open", "-R", self.file])
        self.assertEqual(self.sent, [{"path": self.file, "resultCode": "file_opened"}])

    def test_file_on_windows_selects_in_explorer(self):
        with mock.patch.object(sys, "platform", "win32"), mock.patch.object(host.subprocess, "Popen") as popen:
            host.open_by_shell(self.file)
        popen.assert_called_once_with(["explorer", "/select,", self.file])

    def test_missing_path(self):
        missing = os.path.join(self.dir, "missing")
        with mock.patch.object(host.subprocess, "run") as run:
            host.open_by_shell(missing)
        run.assert_not_called()
        self.assertEqual(len(self.sent), 1)
        self.assertEqual(self.sent[0]["resultCode"], "does_not_exist")
        self.assertEqual(self.sent[0]["path"], missing)


class OpenInBoxDriveTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = self.tmp.name
        self.opened = []
        for patcher in (
            mock.patch.object(host.os.path, "expanduser", return_value=self.home),
            mock.patch.object(host, "open_by_shell", self.opened.append),
            mock.patch.object(host.time, "sleep"),
        ):
            self.sleep = patcher.start()
            self.addCleanup(patcher.stop)

    def test_mac_path_skips_root_folder(self):
        target = Path(self.home, "Library", "CloudStorage", "Box-Box", "Team", "Docs")
        target.mkdir(parents=True)
        with mock.patch.object(sys, "platform", "darwin"):
            host.open_in_box_drive(["All Files", "Team", "Docs"])
        self.assertEqual(self.opened, [str(target)])
        self.sleep.assert_not_called()

    def test_windows_path(self):
        target = Path(self.home, "Box", "Team")
        target.mkdir(parents=True)
        with mock.patch.object(sys, "platform", "win32"):
            host.open_in_box_drive(["All Files", "Team"])
        self.assertEqual(self.opened, [str(target)])

    def test_retries_until_sync_then_gives_up(self):
        with mock.patch.object(sys, "platform", "win32"):
            host.open_in_box_drive(["All Files", "NotSynced"])
        self.assertEqual(self.sleep.call_count, 9)
        self.assertEqual(self.opened, [os.path.join(self.home, "Box", "NotSynced")])


class StdioProtocolTest(unittest.TestCase):
    def test_round_trip_for_missing_file(self):
        missing = os.path.join(tempfile.gettempdir(), "open-box-drive-test-missing-path")
        proc = subprocess.run(
            [sys.executable, str(HOST_PATH)],
            input=frame({"filePath": missing}),
            capture_output=True,
            timeout=10,
            check=True,
        )
        response = unframe(proc.stdout)
        self.assertEqual(response["resultCode"], "does_not_exist")
        self.assertEqual(response["path"], missing)

    def test_truncated_body_exits_with_error(self):
        data = struct.pack("<I", 100) + b"{}"
        proc = subprocess.run([sys.executable, str(HOST_PATH)], input=data, capture_output=True, timeout=10)
        self.assertEqual(proc.returncode, 1)
        self.assertEqual(proc.stdout, b"")


if __name__ == "__main__":
    unittest.main()
