const net = require('net');

function makePacket(msgDict, tag = 1) {
  const entries = Object.entries(msgDict).map(([k, v]) => {
    if (typeof v === 'number') return `\t<key>${k}</key>\n\t<integer>${v}</integer>`;
    return `\t<key>${k}</key>\n\t<string>${v}</string>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${entries}\n</dict>\n</plist>\n`;
  const payload = Buffer.from(xml, 'utf8');
  const header = Buffer.alloc(12);
  header.writeUInt32LE(1, 0); // version PLIST
  header.writeUInt32LE(8, 4); // message PLIST
  header.writeUInt32LE(tag, 8);
  const packet = Buffer.concat([header, payload]);
  const len = Buffer.alloc(4);
  // FIXED: length includes itself (4 bytes) - matches Python's includelength=True
  len.writeUInt32LE(packet.length + 4, 0);
  return Buffer.concat([len, packet]);
}

function recvFull(sock) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const onData = (d) => {
      chunks.push(d);
      const all = Buffer.concat(chunks);
      if (all.length >= 4) {
        const totalLen = all.readUInt32LE(0); // self-inclusive length
        if (all.length >= totalLen) {
          sock.removeListener('data', onData);
          resolve(all.slice(0, totalLen));
        }
      }
    };
    sock.on('data', onData);
    sock.once('error', reject);
    setTimeout(() => reject(new Error('timeout')), 3000);
  });
}

function connect() {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.connect(27015, '127.0.0.1', () => resolve(sock));
    sock.once('error', reject);
  });
}

async function main() {
  // Step 1: probe ReadBUID
  console.log('Step 1: ReadBUID probe...');
  const sock1 = await connect();
  const resp1 = await recvFull(sock1, makePacket({ MessageType: 'ReadBUID' }));
  // send after registering listener
  const probePacket = makePacket({ MessageType: 'ReadBUID' });
  sock1.write(probePacket);
  const probeResp = await recvFull(sock1);
  const buid = probeResp.slice(16).toString('utf8').match(/<string>(.*?)<\/string>/)?.[1];
  console.log('BUID:', buid);
  sock1.destroy();

  // Step 2: ListDevices on fresh connection
  console.log('\nStep 2: ListDevices...');
  const sock2 = await connect();
  sock2.write(makePacket({
    ClientVersionString: 'qt4i-usbmuxd',
    MessageType: 'ListDevices',
    ProgName: 'pymobiledevice3',
    kLibUSBMuxVersion: 3,
  }, 2));
  const resp2 = await recvFull(sock2);
  sock2.destroy();

  const body = resp2.slice(16).toString('utf8');
  const errMatch = body.match(/<key>Number<\/key>\s*<integer>(\d+)<\/integer>/);
  if (errMatch) {
    console.log('Error code:', errMatch[1]);
  } else {
    const serials = [...body.matchAll(/<key>SerialNumber<\/key>\s*<string>(.*?)<\/string>/g)].map(m => m[1]);
    console.log('SUCCESS! Devices:', serials);
  }
}

main().catch(console.error);
