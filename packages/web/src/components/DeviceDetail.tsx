import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export default function DeviceDetail({ udid, api }: { udid: string; api: string }) {
  const [tab, setTab] = useState<'info' | 'screenshot' | 'apps' | 'logs' | 'crashes'>('info');
  const [info, setInfo] = useState<any>(null);
  const [apps, setApps] = useState<any>(null);
  const [crashes, setCrashes] = useState<string[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logRunning, setLogRunning] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInfo(null); setApps(null); setCrashes([]); setScreenshot(null); setLogs([]);
    fetch(`${api}/devices/${udid}`).then(r => r.json()).then(setInfo).catch(() => {});
  }, [udid]);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const takeScreenshot = () => {
    setScreenshot(null);
    fetch(`${api}/devices/${udid}/screenshot`)
      .then(r => r.blob())
      .then(b => setScreenshot(URL.createObjectURL(b)))
      .catch(() => {});
  };

  const loadApps = () => {
    setApps(null);
    fetch(`${api}/devices/${udid}/apps`).then(r => r.json()).then(setApps).catch(() => {});
  };

  const loadCrashes = () => {
    setCrashes([]);
    fetch(`${api}/devices/${udid}/crashes`).then(r => r.json()).then(setCrashes).catch(() => {});
  };

  const toggleLogs = () => {
    if (logRunning) {
      socketRef.current?.emit('unsubscribe:logs', udid);
      socketRef.current?.disconnect();
      socketRef.current = null;
      setLogRunning(false);
    } else {
      const s = io(api || window.location.origin);
      socketRef.current = s;
      s.emit('subscribe:logs', udid);
      s.on('log:line', (line: string) => setLogs(prev => [...prev.slice(-500), line]));
      setLogRunning(true);
    }
  };

  useEffect(() => () => { socketRef.current?.disconnect(); }, []);

  const tabs: Array<typeof tab> = ['info', 'screenshot', 'apps', 'logs', 'crashes'];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{udid}</div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === 'screenshot') takeScreenshot(); if (t === 'apps') loadApps(); if (t === 'crashes') loadCrashes(); }}
            style={{ padding: '6px 14px', borderRadius: 6, background: tab === t ? '#2563eb' : '#1a1a1a', border: `1px solid ${tab === t ? '#2563eb' : '#2a2a2a'}`, color: '#e0e0e0', fontSize: 13 }}>
            {t}
          </button>
        ))}
      </div>

      {/* Info */}
      {tab === 'info' && (
        <div className="card">
          {!info ? <span style={{ color: '#6b7280' }}>Loading…</span> : (
            <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
              <tbody>
                {Object.entries(info as Record<string, any>)
                  .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
                  .slice(0, 30)
                  .map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: '5px 12px 5px 0', color: '#9ca3af', whiteSpace: 'nowrap' }}>{k}</td>
                      <td style={{ padding: '5px 0', wordBreak: 'break-all' }}>{String(v)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Screenshot */}
      {tab === 'screenshot' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn-primary" onClick={takeScreenshot} style={{ alignSelf: 'flex-start' }}>↻ Refresh</button>
          {screenshot
            ? <img src={screenshot} alt="screenshot" style={{ maxHeight: 600, borderRadius: 8, border: '1px solid #2a2a2a' }} />
            : <span style={{ color: '#6b7280' }}>Loading screenshot…</span>}
        </div>
      )}

      {/* Apps */}
      {tab === 'apps' && (
        <div className="card">
          {!apps ? <span style={{ color: '#6b7280' }}>Loading…</span> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 500, overflow: 'auto' }}>
              {Object.entries(apps as Record<string, any>).map(([id, info]: [string, any]) => (
                <div key={id} style={{ padding: '8px 0', borderBottom: '1px solid #2a2a2a', fontSize: 13 }}>
                  <strong>{info.CFBundleDisplayName ?? info.CFBundleName ?? id}</strong>
                  <span style={{ color: '#6b7280', marginLeft: 8, fontSize: 11 }}>{id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      {tab === 'logs' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={toggleLogs} className={logRunning ? 'btn-danger' : 'btn-primary'} style={{ alignSelf: 'flex-start' }}>
            {logRunning ? '⏹ Stop' : '▶ Start Logs'}
          </button>
          <div style={{ background: '#0d0d0d', borderRadius: 6, padding: 10, height: 400, overflow: 'auto', fontFamily: 'monospace', fontSize: 11 }}>
            {logs.map((l, i) => <div key={i}>{l}</div>)}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Crashes */}
      {tab === 'crashes' && (
        <div className="card">
          {crashes.length === 0
            ? <span style={{ color: '#6b7280', fontSize: 13 }}>No crash reports</span>
            : crashes.map(c => (
              <div key={c} style={{ padding: '8px 0', borderBottom: '1px solid #2a2a2a', fontSize: 12, fontFamily: 'monospace', color: '#fca5a5' }}>{c}</div>
            ))}
        </div>
      )}
    </div>
  );
}
