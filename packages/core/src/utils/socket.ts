import net from 'net';

/**
 * Read exactly `size` bytes from `socket`.
 * Rejects with a timeout error if `timeoutMs` elapses before all bytes arrive.
 */
export function readExactly(socket: net.Socket, size: number, timeoutMs = 10000): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let received = 0;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => cleanup(new Error('Socket receive timeout')), timeoutMs);

    const tryRead = () => {
      while (received < size) {
        const chunk = socket.read(size - received) as Buffer | null;
        if (!chunk) break;
        chunks.push(chunk);
        received += chunk.length;
      }
      if (received >= size) {
        clearTimeout(timer);
        socket.removeListener('readable', tryRead);
        socket.removeListener('error', onError);
        socket.removeListener('close', onClose);
        resolve(Buffer.concat(chunks).subarray(0, size));
      }
    };

    const onError = (e: Error) => cleanup(new Error(`Socket error: ${e.message}`));
    const onClose = () => cleanup(new Error('Socket closed'));

    const cleanup = (err: Error) => {
      clearTimeout(timer);
      socket.removeListener('readable', tryRead);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
      reject(err);
    };

    socket.on('readable', tryRead);
    socket.once('error', onError);
    socket.once('close', onClose);
    tryRead();
  });
}
