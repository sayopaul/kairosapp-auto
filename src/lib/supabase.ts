import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const supabaseUrl = "https://mmltzetxcvdjxkizqrjz.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tbHR6ZXR4Y3ZkanhraXpxcmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1OTQ3ODIsImV4cCI6MjA2NjE3MDc4Mn0.3oMQIIuB35quecul991Uni7Z7HX-KLgdYfQyHzbIxU8";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'autotradetcg-web'
    }
  }
});

// Add connection test
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('Supabase connection error:', error);
  } else {
    console.log('Supabase connected successfully');
  }
});