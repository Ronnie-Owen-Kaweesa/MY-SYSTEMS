import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pnoenacuwkvixaybpeji.supabase.co';
const supabaseAnonKey = 'sb_publishable_wWKShWvl84Tw4kTz3zAE_g_3UMk89S5';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
