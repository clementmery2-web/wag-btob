import { redirect } from 'next/navigation';
import { verifySession } from '../lib/auth';
import { PricingShell } from './shell';

export async function AuthGuard({ children }: { children: React.ReactNode }) {
  const valid = await verifySession();
  if (!valid) redirect('/pricing/login');
  return <PricingShell>{children}</PricingShell>;
}
