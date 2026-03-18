import { AuthGuard } from '../../components/auth-guard';
import { NouvelleOffreClient } from './nouvelle-client';

export default function NouvelleOffrePage() {
  return (
    <AuthGuard>
      <NouvelleOffreClient />
    </AuthGuard>
  );
}
