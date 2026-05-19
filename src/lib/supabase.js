import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://taworiusfdipiegepbcw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhd29yaXVzZmRpcGllZ2VwYmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNTIzNDgsImV4cCI6MjA5NDcyODM0OH0.8mUci2WInVmBEcyA7Y-_4y5MpF-PZGFBe5ZAd14dPB8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)