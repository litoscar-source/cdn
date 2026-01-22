import { createClient } from '@supabase/supabase-js';

// Safe access to environment variables
// Use fallback object in case import.meta.env is undefined
const env = (import.meta as any).env || {};

// Use provided credentials as default if env vars are missing
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://tuzaobafjiokivvsvtii.supabase.co';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1emFvYmFmamlva2l2dnN2dGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzU1MDQsImV4cCI6MjA4NDUxMTUwNH0.7nWRDHPxkpWNA-p8JgW5-9cECU1miOmpqNErvtB4Tw4';

export const supabase = createClient(supabaseUrl, supabaseKey);