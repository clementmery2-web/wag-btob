import { AuthGuard } from '../components/auth-guard'
import { PricingValidationClient } from './pricing-client'

export default function PricingValidationPage() {
  return (
    <AuthGuard>
      <PricingValidationClient />
    </AuthGuard>
  )
}
