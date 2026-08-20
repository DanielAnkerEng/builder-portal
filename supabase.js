import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://oqwpfnmqeriupujpssxz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_BcJUAYkgF3nHpdbCyHd1eA_pQ3yEA15'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)