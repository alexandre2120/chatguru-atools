import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function createServerClient(workspaceHash?: string) {
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: fetch.bind(globalThis),
    },
  })

  // For now, we're not using RLS with workspace_hash
  // Later we can enable this:
  // if (workspaceHash) {
  //   client.rpc('set_config', {
  //     setting: 'app.workspace_hash',
  //     value: workspaceHash,
  //   })
  // }

  return client
}