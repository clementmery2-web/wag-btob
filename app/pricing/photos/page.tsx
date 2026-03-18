import { AuthGuard } from '../components/auth-guard';
import { PhotosClient } from './photos-client';

export default function PhotosPage() {
  return (
    <AuthGuard>
      <PhotosClient />
    </AuthGuard>
  );
}
