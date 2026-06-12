// eslint-disable-next-line @typescript-eslint/no-require-imports
const bplist = require('bplist-parser');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bplistCreator = require('bplist-creator') as (obj: any) => Buffer;

bplist.maxObjectCount = 500000;
bplist.maxObjectSize = 100 * 1024 * 1024;

/**
 * Minimal NSKeyedArchiver/Unarchiver for DTX primitive types.
 * Only handles the subset used by Instruments: primitives, arrays, dicts, NSNull, NSError.
 */

const NSKeyedArchiver_TOP_KEY = '$top';
const NSKeyedArchiver_OBJECTS_KEY = '$objects';
const NSKeyedArchiver_ARCHIVER_KEY = '$archiver';
const NSKeyedArchiver_VERSION_KEY = '$version';
const NSKeyedArchiver_CLASS_KEY = '$class';
const NSKeyedArchiver_CLASSNAME_KEY = '$classname';

function resolveRef(idx: number, objects: any[]): any {
  const obj = objects[idx];
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object' || Buffer.isBuffer(obj) || Array.isArray(obj)) return obj;

  const className = obj[NSKeyedArchiver_CLASS_KEY]
    ? objects[obj[NSKeyedArchiver_CLASS_KEY].UID ?? obj[NSKeyedArchiver_CLASS_KEY]]?.[NSKeyedArchiver_CLASSNAME_KEY]
    : null;

  if (className === 'NSNull') return null;
  if (className === 'NSMutableArray' || className === 'NSArray') {
    const values = obj['NS.objects'];
    if (!Array.isArray(values)) return [];
    return values.map((v: any) => v && typeof v === 'object' && 'UID' in v ? resolveRef(v.UID, objects) : v);
  }
  if (className === 'NSMutableDictionary' || className === 'NSDictionary') {
    const keys = obj['NS.keys'];
    const vals = obj['NS.objects'];
    const result: Record<string, any> = {};
    if (Array.isArray(keys) && Array.isArray(vals)) {
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i] && typeof keys[i] === 'object' && 'UID' in keys[i] ? resolveRef(keys[i].UID, objects) : keys[i];
        const v = vals[i] && typeof vals[i] === 'object' && 'UID' in vals[i] ? resolveRef(vals[i].UID, objects) : vals[i];
        result[String(k)] = v;
      }
    }
    return result;
  }
  if (className === 'NSMutableString' || className === 'NSString') {
    return obj['NS.string'] ?? obj['NS.bytes'] ?? '';
  }
  if (className === 'NSMutableData' || className === 'NSData') {
    return obj['NS.data'] ?? obj['NS.bytes'] ?? Buffer.alloc(0);
  }
  if (className === 'NSError') {
    const domain = obj['NSDomain'] && typeof obj['NSDomain'] === 'object' && 'UID' in obj['NSDomain']
      ? resolveRef(obj['NSDomain'].UID, objects) : obj['NSDomain'];
    return { _nsError: true, domain, code: obj['NSCode'], userInfo: obj['NSUserInfo'] };
  }
  if (className === 'NSUUID') {
    const bytes = obj['NS.uuidbytes'];
    if (Buffer.isBuffer(bytes) && bytes.length === 16) {
      return `${bytes.subarray(0,4).toString('hex')}-${bytes.subarray(4,6).toString('hex')}-${bytes.subarray(6,8).toString('hex')}-${bytes.subarray(8,10).toString('hex')}-${bytes.subarray(10).toString('hex')}`;
    }
    return null;
  }
  if (className === 'NSDate') {
    // Apple epoch: 2001-01-01
    const secs = obj['NS.time'];
    return new Date((secs + 978307200) * 1000);
  }
  if (className === 'DTTapMessage' || className === 'DTSysmonTapMessage' || className === 'DTKTraceTapMessage') {
    const plistData = obj['DTTapMessagePlist'];
    if (plistData) {
      const raw = plistData && typeof plistData === 'object' && 'UID' in plistData ? resolveRef(plistData.UID, objects) : plistData;
      if (Buffer.isBuffer(raw)) {
        try { return (bplist.parseBuffer(raw) as any[])[0]; } catch { return raw; }
      }
    }
    return obj;
  }
  // Unknown class — return raw properties (resolving refs)
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === NSKeyedArchiver_CLASS_KEY) continue;
    result[k] = v && typeof v === 'object' && 'UID' in (v as any) ? resolveRef((v as any).UID, objects) : v;
  }
  if (className) result.$class = className;
  return result;
}

export function unarchive(data: Buffer): any {
  let parsed: any;
  try {
    parsed = (bplist.parseBuffer(data) as any[])[0];
  } catch {
    return null;
  }
  if (!parsed || parsed[NSKeyedArchiver_ARCHIVER_KEY] !== 'NSKeyedArchiver') return parsed;
  const objects: any[] = parsed[NSKeyedArchiver_OBJECTS_KEY] ?? [];
  const top = parsed[NSKeyedArchiver_TOP_KEY];
  if (!top) return null;
  const rootRef = top.root;
  if (rootRef && typeof rootRef === 'object' && 'UID' in rootRef) {
    return resolveRef(rootRef.UID, objects);
  }
  return null;
}

/** Archive a single value (string, dict, etc.) as NSKeyedArchive bplist. */
export function archiveValue(val: any): Buffer {
  function buildObjects(v: any, objects: any[]): any {
    if (v === null || v === undefined) return { UID: 0 };
    if (typeof v === 'string') {
      const idx = objects.length; objects.push(v); return { UID: idx };
    }
    if (typeof v === 'number' || typeof v === 'boolean') {
      const idx = objects.length; objects.push(v); return { UID: idx };
    }
    if (Buffer.isBuffer(v)) {
      const idx = objects.length; objects.push(v); return { UID: idx };
    }
    if (Array.isArray(v)) {
      const subRefs = v.map(e => buildObjects(e, objects));
      const classIdx = objects.length + 1;
      const arrIdx = objects.length;
      objects.push({ '$class': { UID: classIdx }, 'NS.objects': subRefs });
      objects.push({ '$classname': 'NSArray', '$classes': ['NSArray', 'NSObject'] });
      return { UID: arrIdx };
    }
    if (typeof v === 'object') {
      const keys = Object.keys(v);
      const keyRefs = keys.map(k => buildObjects(k, objects));
      const valRefs = keys.map(k => buildObjects(v[k], objects));
      const classIdx = objects.length + 1;
      const dictIdx = objects.length;
      objects.push({ '$class': { UID: classIdx }, 'NS.keys': keyRefs, 'NS.objects': valRefs });
      objects.push({ '$classname': 'NSDictionary', '$classes': ['NSDictionary', 'NSObject'] });
      return { UID: dictIdx };
    }
    return { UID: 0 };
  }

  const objects: any[] = ['$null'];
  const rootRef = buildObjects(val, objects);
  return bplistCreator({
    '$archiver': 'NSKeyedArchiver',
    '$version': 100000,
    '$top': { root: rootRef },
    '$objects': objects,
  }) as Buffer;
}

