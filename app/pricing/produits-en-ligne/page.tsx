import { AuthGuard } from '../components/auth-guard'

export default function ProduitsEnLignePage() {
  return (
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{
          padding: '10px 24px',
          borderBottom: '0.5px solid #e5e7eb',
          display: 'flex', alignItems: 'center', gap: '12px',
          background: 'white', flexShrink: 0,
        }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>Catalogue acheteurs</span>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>Vue en temps réel</span>
          <a href="/" target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '12px', color: '#16a34a', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Ouvrir en plein écran
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10 2h4v4M14 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </a>
        </div>
        <iframe
          src="/"
          style={{ flex: 1, border: 'none', width: '100%', display: 'block' }}
          title="Catalogue acheteurs"
        />
      </div>
    </AuthGuard>
  )
}
