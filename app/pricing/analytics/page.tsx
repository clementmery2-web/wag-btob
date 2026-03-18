import { AuthGuard } from '../components/auth-guard';
import { AnalyticsClient } from './analytics-client';

export default function AnalyticsPage() {
  return (
    <AuthGuard>
      <AnalyticsClient />
    </AuthGuard>
  );
}
