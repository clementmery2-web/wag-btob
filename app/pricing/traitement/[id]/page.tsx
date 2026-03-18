import { AuthGuard } from '../../components/auth-guard';
import { TraitementClient } from './traitement-client';

export default async function TraitementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AuthGuard>
      <TraitementClient offreId={id} />
    </AuthGuard>
  );
}
