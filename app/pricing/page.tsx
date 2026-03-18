import { AuthGuard } from './components/auth-guard';
import { DashboardClient } from './components/dashboard-client';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardClient />
    </AuthGuard>
  );
}
