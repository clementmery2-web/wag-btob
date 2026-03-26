import { AuthGuard } from '../components/auth-guard'

export default function AttributionPage() {
  return (
    <AuthGuard>
      <div style={{ padding: '2rem' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '8px', color: '#111827' }}>Attribution</h1>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>Cette section est en cours de développement.</p>
      </div>
    </AuthGuard>
  )
}
