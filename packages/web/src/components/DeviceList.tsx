import { Device } from '../App';

export default function DeviceList({ devices, selected, onSelect }: {
  devices: Device[];
  selected: string | null;
  onSelect: (udid: string) => void;
}) {
  if (!devices.length) return <span style={{ color: '#6b7280', fontSize: 13 }}>No devices connected</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {devices.map(d => (
        <button
          key={d.udid}
          onClick={() => onSelect(d.udid)}
          style={{
            textAlign: 'left', padding: '10px 12px', borderRadius: 8,
            background: selected === d.udid ? '#1e3a5f' : '#1a1a1a',
            border: `1px solid ${selected === d.udid ? '#2563eb' : '#2a2a2a'}`,
            color: '#e0e0e0', fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span>📱</span>
            <span className={`badge ${d.connectionType === 'USB' ? 'badge-usb' : 'badge-wifi'}`}>{d.connectionType}</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', wordBreak: 'break-all' }}>{d.udid}</div>
        </button>
      ))}
    </div>
  );
}
