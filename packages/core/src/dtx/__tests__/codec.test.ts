import { fragmentPayload, parseFragmentHeader } from '../fragment';
import { DTX_FRAGMENT_MAGIC, FRAGMENT_HEADER_SIZE, MAX_FRAGMENT_SIZE } from '../types';
import { archiveValue, unarchive } from '../nska';
import { encodeAux, decodeAux } from '../dtx-aux';

describe('fragmentPayload', () => {
  it('splits payload into correct number of fragments', () => {
    const MAX_BODY = MAX_FRAGMENT_SIZE - FRAGMENT_HEADER_SIZE;
    const payload = Buffer.alloc(MAX_BODY + 50, 0xAB);
    const frags = fragmentPayload(payload, 1, 0, 0, 1);
    expect(frags.length).toBe(2);
  });

  it('each fragment header has correct magic and count', () => {
    const MAX_BODY = MAX_FRAGMENT_SIZE - FRAGMENT_HEADER_SIZE;
    const payload = Buffer.alloc(MAX_BODY + 50);
    const frags = fragmentPayload(payload, 1, 0, 0, 1);
    for (const frag of frags) {
      const hdr = parseFragmentHeader(frag);
      expect(hdr.magic).toBe(DTX_FRAGMENT_MAGIC);
      expect(hdr.count).toBe(2);
    }
  });

  it('fragment indices are sequential', () => {
    const MAX_BODY = MAX_FRAGMENT_SIZE - FRAGMENT_HEADER_SIZE;
    const payload = Buffer.alloc(MAX_BODY + 50);
    const frags = fragmentPayload(payload, 1, 0, 0, 1);
    expect(parseFragmentHeader(frags[0]).index).toBe(0);
    expect(parseFragmentHeader(frags[1]).index).toBe(1);
  });

  it('single fragment for small payload', () => {
    const payload = Buffer.alloc(100);
    const frags = fragmentPayload(payload, 5, 0, 0, 0);
    expect(frags.length).toBe(1);
    const hdr = parseFragmentHeader(frags[0]);
    expect(hdr.dataSize).toBe(100);
    expect(frags[0].length).toBe(FRAGMENT_HEADER_SIZE + 100);
  });
});

describe('nska archiveValue/unarchive roundtrip', () => {
  it('string roundtrip', () => {
    const buf = archiveValue('hello world');
    expect(unarchive(buf)).toBe('hello world');
  });

  it('number roundtrip', () => {
    const buf = archiveValue(42);
    expect(unarchive(buf)).toBe(42);
  });

  it('Buffer roundtrip', () => {
    const orig = Buffer.from([1, 2, 3, 4]);
    const buf = archiveValue(orig);
    const result = unarchive(buf);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(orig);
  });

  it('Array roundtrip', () => {
    const arr = ['a', 'b', 'c'];
    const buf = archiveValue(arr);
    const result = unarchive(buf);
    expect(result).toEqual(arr);
  });
});

describe('dtx-aux encodeAux/decodeAux', () => {
  it('integer roundtrip', () => {
    const encoded = encodeAux([42]);
    const decoded = decodeAux(encoded);
    expect(decoded).toEqual([42]);
  });

  it('string roundtrip', () => {
    const encoded = encodeAux(['hello']);
    const decoded = decodeAux(encoded);
    expect(decoded).toEqual(['hello']);
  });

  it('multiple args', () => {
    const encoded = encodeAux([1, 'test', 99]);
    const decoded = decodeAux(encoded);
    expect(decoded).toEqual([1, 'test', 99]);
  });

  it('empty args returns empty buffer and decodes to empty', () => {
    const encoded = encodeAux([]);
    expect(encoded.length).toBe(0);
    expect(decodeAux(encoded)).toEqual([]);
  });
});
