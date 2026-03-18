import { AuthGuard } from '../components/auth-guard';
import { DocsClient } from './docs-client';

export default function DocsPage() {
  return (
    <AuthGuard>
      <DocsClient />
    </AuthGuard>
  );
}
