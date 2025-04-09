import sys
import os
import json
import subprocess
import struct
import time

#import logging
#logging.basicConfig(filename='output.log', level=logging.INFO)
#logger = logging.getLogger()
#logger.flush = True

def open_by_shell(path):
    path = path.rstrip(os.sep)
    try:
        stats = os.stat(path)
        if stats.st_mode & 0o40000:  # directory
            if sys.platform == "win32":
                subprocess.run(["explorer", path])
            elif sys.platform == "darwin":  # MacOS
                subprocess.run(["open", path])
            send({
                'path': path,
                'resultCode': 'directory_opened'
            })
        else:  # file
            if sys.platform == "win32":
                subprocess.Popen(["explorer", "/select,", path])
            elif sys.platform == "darwin":  # MacOS
                subprocess.run(["open", "-R", path])
            send({
                'path': path,
                'resultCode': 'file_opened'
            })
    except FileNotFoundError as e:
        send({
            'path': path,
            'resultCode': 'does_not_exist',
            'err': str(e)
        })

def open_in_box_drive(elements):
    home = os.path.expanduser("~")
    if sys.platform == "darwin": # MacOS
        path = os.path.join(home, "Library", "CloudStorage", "Box-Box", *elements[1:])
    else:
        path = os.path.join(home, 'Box', *elements[1:])
    try:
        stats = os.stat(path)
    except FileNotFoundError:  # Retry once after a delay
        time.sleep(0.2)
    open_by_shell(path)

def send(message_object):
    message = json.dumps(message_object)
    message_buffer = message.encode('utf-8')
    length = len(message_buffer)
    length_buffer = struct.pack('<I', length)

    sys.stdout.buffer.write(length_buffer)
    sys.stdout.buffer.write(message_buffer)
    sys.stdout.buffer.flush()


length_bytes = 4
if __name__ == "__main__":
    length_buffer = sys.stdin.buffer.read(length_bytes)
    body_length = struct.unpack('<I', length_buffer)[0]
    #body_length = int.from_bytes(length_buffer, byteorder='little')
    #logger.debug(body_length)
    body_buffer = sys.stdin.buffer.read(body_length)
    #logger.debug(body_buffer)

    if len(body_buffer) != body_length:
        sys.exit(1)
    
    input_data = json.loads(body_buffer.decode('utf-8'))
    #logger.info(input_data)

    if 'filePath' in input_data:
        open_by_shell(input_data['filePath'])
    elif 'boxPath' in input_data:
        open_in_box_drive(input_data['boxPath'])

