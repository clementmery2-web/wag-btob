import { AuthGuard } from '../../components/auth-guard';
import { ValidationClient } from './validation-client';

export default async function ValidationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AuthGuard>
      <ValidationClient offreId={id} />
    </AuthGuard>
  );
}
