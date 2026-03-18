import { AuthGuard } from '../components/auth-guard';
import { OffresClient } from './offres-client';

export default function OffresPage() {
  return (
    <AuthGuard>
      <OffresClient />
    </AuthGuard>
  );
}
