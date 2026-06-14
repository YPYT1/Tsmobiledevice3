import { useState, useEffect } from 'react';
import DeviceList from './components/DeviceList';
import DeviceDetail from './components/DeviceDetail';

export interface Device {
  udid: string;
  connectionType: 'USB' | 'Network';
}

const API = '';

export default function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    fetch(`${API}/devices`)
      .then(r => r.json())
      .then(setDevices)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); const t = setInterval(refresh, 5000); return () => clearInterval(t); }, []);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside style={{ width: 260, borderRight: '1px solid #2a2a2a', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>📱 ts-mobiledevice</span>
          <button className="btn-primary" onClick={refresh} style={{ padding: '4px 10px' }}>↻</button>
        </div>
        {loading && <span style={{ color: '#6b7280', fontSize: 13 }}>Scanning…</span>}
        {error && <span style={{ color: '#f87171', fontSize: 12 }}>{error}</span>}
        <DeviceList devices={devices} selected={selected} onSelect={setSelected} />
      </aside>
      <main style={{ flex: 1, overflow: 'auto' }}>
        {selected
          ? <DeviceDetail udid={selected} api={API} />
          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4b5563' }}>
              Select a device
            </div>
        }
      </main>
    </div>
  );
}
