import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const TABS = ['info', 'screenshot', 'apps', 'logs', 'perf', 'location', 'crashes'] as const;
type Tab = typeof TABS[number];

export default function DeviceDetail({ udid, api }: { udid: string; api: string }) {
  const [tab, setTab] = useState<Tab>('info');
  const [info, setInfo] = useState<any>(null);
  const [apps, setApps] = useState<any>(null);
  const [crashes, setCrashes] = useState<string[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logRunning, setLogRunning] = useState(false);
  const [perfSamples, setPerfSamples] = useState<Array<{cpu: number; mem: number; t: string}>>([]);
  const [perfRunning, setPerfRunning] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locationMsg, setLocationMsg] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInfo(null); setApps(null); setCrashes([]); setScreenshot(null); setLogs([]); setPerfSamples([]);
    fetch(`${api}/devices/${udid}`).then(r => r.json()).then(setInfo).catch(() => {});
  }, [udid]);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const takeScreenshot = () => {
    setScreenshot(null);
    fetch(`${api}/devices/${udid}/screenshot`).then(r => r.blob()).then(b => setScreenshot(URL.createObjectURL(b))).catch(() => {});
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
      socketRef.current?.disconnect(); socketRef.current = null; setLogRunning(false);
    } else {
      const s = io(api || window.location.origin); socketRef.current = s;
      s.emit('subscribe:logs', udid);
      s.on('log:line', (line: string) => setLogs(p => [...p.slice(-500), line]));
      setLogRunning(true);
    }
  };

  const togglePerf = () => {
    if (perfRunning) {
      socketRef.current?.emit('unsubscribe:perf', udid);
      socketRef.current?.disconnect(); socketRef.current = null; setPerfRunning(false);
    } else {
      const s = io(api || window.location.origin); socketRef.current = s;
      s.emit('subscribe:perf', udid);
      s.on('perf:sample', (sample: any) => {
        const sys = Array.isArray(sample.SystemCPUUsage) ? sample.SystemCPUUsage[0] : sample.SystemCPUUsage ?? sample;
        const cpu = +(sys?.CPUTotalLoad ?? sys?.CPU_TotalLoad ?? 0).toFixed(1);
        const mem = +((sys?.vmUsedMemory ?? sys?.physMemUsed ?? 0) / 1024 / 1024).toFixed(0);
        const t = new Date().toTimeString().slice(3, 8);
        setPerfSamples(p => [...p.slice(-59), { cpu, mem, t }]);
      });
      setPerfRunning(true);
    }
  };

  const setLocation = async () => {
    setLocationMsg('Setting…');
    try {
      await fetch(`${api}/devices/${udid}/location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: +lat, lng: +lng }) });
      setLocationMsg('✅ Location set');
    } catch { setLocationMsg('❌ Failed'); }
  };
  const resetLocation = async () => {
    setLocationMsg('Resetting…');
    try { await fetch(`${api}/devices/${udid}/location`, { method: 'DELETE' }); setLocationMsg('✅ Reset'); }
    catch { setLocationMsg('❌ Failed'); }
  };

  useEffect(() => () => { socketRef.current?.disconnect(); }, []);

  const onTabClick = (t: Tab) => {
    setTab(t);
    if (t === 'screenshot') takeScreenshot();
    if (t === 'apps') loadApps();
    if (t === 'crashes') loadCrashes();
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{udid}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => onTabClick(t)}
            style={{ padding: '6px 14px', borderRadius: 6, background: tab === t ? '#2563eb' : '#1a1a1a', border: `1px solid ${tab === t ? '#2563eb' : '#2a2a2a'}`, color: '#e0e0e0', fontSize: 13 }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="card">
          {!info ? <span style={{ color: '#6b7280' }}>Loading…</span> : (
            <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
              <tbody>
                {Object.entries(info as Record<string, any>)
                  .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
                  .slice(0, 30).map(([k, v]) => (
                    <tr key={k}><td style={{ padding: '5px 12px 5px 0', color: '#9ca3af', whiteSpace: 'nowrap' }}>{k}</td>
                    <td style={{ padding: '5px 0', wordBreak: 'break-all' }}>{String(v)}</td></tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'screenshot' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn-primary" onClick={takeScreenshot} style={{ alignSelf: 'flex-start' }}>↻ Refresh</button>
          {screenshot ? <img src={screenshot} alt="screenshot" style={{ maxHeight: 600, borderRadius: 8, border: '1px solid #2a2a2a' }} />
            : <span style={{ color: '#6b7280' }}>Loading…</span>}
        </div>
      )}

      {tab === 'apps' && (
        <div className="card">
          {!apps ? <span style={{ color: '#6b7280' }}>Loading…</span> : (
            <div style={{ maxHeight: 500, overflow: 'auto' }}>
              {Object.entries(apps as Record<string, any>).map(([id, i]: [string, any]) => (
                <div key={id} style={{ padding: '8px 0', borderBottom: '1px solid #2a2a2a', fontSize: 13 }}>
                  <strong>{i.CFBundleDisplayName ?? i.CFBundleName ?? id}</strong>
                  <span style={{ color: '#6b7280', marginLeft: 8, fontSize: 11 }}>{id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {tab === 'perf' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={togglePerf} className={perfRunning ? 'btn-danger' : 'btn-primary'} style={{ alignSelf: 'flex-start' }}>
            {perfRunning ? '⏹ Stop' : '▶ Start Perf'}
          </button>
          {perfSamples.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <MiniChart label="CPU %" color="#2563eb" data={perfSamples.map(s => s.cpu)} max={100} />
              <MiniChart label="MEM (MB)" color="#16a34a" data={perfSamples.map(s => s.mem)} max={Math.max(...perfSamples.map(s => s.mem)) * 1.2} />
              <div style={{ fontSize: 12, color: '#9ca3af' }}>
                CPU: {perfSamples.at(-1)?.cpu}% &nbsp; MEM: {perfSamples.at(-1)?.mem} MB
              </div>
            </div>
          )}
          {!perfSamples.length && perfRunning && <span style={{ color: '#6b7280' }}>Waiting for samples…</span>}
        </div>
      )}

      {tab === 'location' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, color: '#9ca3af' }}>Latitude</label>
              <input value={lat} onChange={e => setLat(e.target.value)} placeholder="37.7749"
                style={{ padding: '6px 10px', borderRadius: 6, background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#e0e0e0', width: 140, fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, color: '#9ca3af' }}>Longitude</label>
              <input value={lng} onChange={e => setLng(e.target.value)} placeholder="-122.4194"
                style={{ padding: '6px 10px', borderRadius: 6, background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#e0e0e0', width: 140, fontSize: 13 }} />
            </div>
            <button className="btn-primary" onClick={setLocation} disabled={!lat || !lng}>Set Location</button>
            <button onClick={resetLocation} style={{ padding: '6px 14px', borderRadius: 6, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#9ca3af', fontSize: 13 }}>Reset</button>
          </div>
          {locationMsg && <span style={{ fontSize: 13, color: locationMsg.startsWith('✅') ? '#4ade80' : '#f87171' }}>{locationMsg}</span>}
        </div>
      )}

      {tab === 'crashes' && (
        <div className="card">
          {crashes.length === 0 ? <span style={{ color: '#6b7280', fontSize: 13 }}>No crash reports</span>
            : crashes.map(c => <div key={c} style={{ padding: '8px 0', borderBottom: '1px solid #2a2a2a', fontSize: 12, fontFamily: 'monospace', color: '#fca5a5' }}>{c}</div>)}
        </div>
      )}
    </div>
  );
}

function MiniChart({ label, color, data, max }: { label: string; color: string; data: number[]; max: number }) {
  const W = 480; const H = 60; const n = data.length;
  if (!n) return null;
  const pts = data.map((v, i) => `${(i / Math.max(n - 1, 1)) * W},${H - (v / max) * H}`).join(' ');
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
      <svg width={W} height={H} style={{ display: 'block', borderRadius: 4, background: '#0d0d0d' }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
      </svg>
    </div>
  );
}
