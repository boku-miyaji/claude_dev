import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // We don't use Supabase's own OAuth providers, so disable URL detection.
    // Otherwise it hijacks `?code=` from Google Calendar's OAuth callback and
    // races with our handler, blocking the post-success navigation.
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
})
