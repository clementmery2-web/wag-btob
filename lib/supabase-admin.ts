import { createClient } from '@supabase/supabase-js'

// Importer UNIQUEMENT depuis app/api/** et app/pricing/**/page.tsx
// JAMAIS depuis des composants clients ou pages publiques
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
