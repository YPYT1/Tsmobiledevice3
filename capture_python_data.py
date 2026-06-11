# 抓取 Python pymobiledevice3 的真实通信数据

import plistlib
import struct
import socket
import sys

def capture_python_communication():
    print("========================================")
    print("  Python plistlib Communication Capture")
    print("========================================\n")

    # 连接到 AMDS
    print("1. Connecting to iTunes AMDS...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect(('127.0.0.1', 27015))
    print("   Connected!\n")

    # 构建请求（完全按照 Python pymobiledevice3 的方式）
    request = {
        'ClientVersionString': 'qt4i-usbmuxd',
        'MessageType': 'ListDevices',
        'ProgName': 'pymobiledevice3',
        'kLibUSBMuxVersion': 3
    }

    # 使用 plistlib.dumps() 生成 plist
    plist_data = plistlib.dumps(request)

    print("Package: Python plistlib.dumps() 输出:")
    print("   长度:", len(plist_data))
    print("   前 100 字节:", plist_data[:100])
    print()
    print("   完整内容:")
    print(plist_data.decode())
    print()

    # 构建 packet
    version = 1
    message_type = 8
    tag = 1

    header = struct.pack('<III', version, message_type, tag)
    print("Header: Header:")
    print("   长度:", len(header))
    print("   Hex:", header.hex())
    print("   Version:", version)
    print("   MessageType:", message_type)
    print("   Tag:", tag)
    print()

    packet = header + plist_data
    print("Package: Packet:")
    print("   长度:", len(packet))
    print()

    # 添加长度前缀
    length_prefix = struct.pack('<I', len(packet))
    full_packet = length_prefix + packet

    print("Package: 完整数据包:")
    print("   总长度:", len(full_packet))
    print("   长度前缀:", len(packet))
    print("   前 100 字节 Hex:", full_packet[:100].hex())
    print()

    # 发送
    print("Sending data...")
    sock.sendall(full_packet)
    print("   Sent!\n")

    # 接收响应
    print("Receiving response...")
    response_data = b''
    while True:
        chunk = sock.recv(4096)
        if not chunk:
            break
        response_data += chunk
        if len(response_data) > 4:
            packet_length = struct.unpack('<I', response_data[:4])[0]
            if len(response_data) >= 4 + packet_length:
                break

    print(f"   Received {len(response_data)} bytes\n")

    # 解析响应
    packet_length = struct.unpack('<I', response_data[:4])[0]
    print("Package: 响应 Packet:")
    print("   Packet 长度:", packet_length)

    response_packet = response_data[4:4+packet_length]

    resp_version = struct.unpack('<I', response_packet[:4])[0]
    resp_message_type = struct.unpack('<I', response_packet[4:8])[0]
    resp_tag = struct.unpack('<I', response_packet[8:12])[0]

    print("   Version:", resp_version)
    print("   MessageType:", resp_message_type)
    print("   Tag:", resp_tag)
    print()

    # 解析 plist
    resp_plist_data = response_packet[12:]
    print("Header: 响应 Plist:")
    print("   长度:", len(resp_plist_data))
    print("   内容:")
    print(resp_plist_data.decode())
    print()

    # 解析 plist
    response_obj = plistlib.loads(resp_plist_data)
    print("SUCCESS! Parsed response object:")
    print(response_obj)
    print()

    sock.close()

    print("========================================")
    print("  Capture Complete")
    print("========================================")

if __name__ == '__main__':
    try:
        capture_python_communication()
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
