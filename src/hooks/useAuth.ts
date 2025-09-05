import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    try {
      setLoading(true);
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.log('Session invalidated during refetch - this is expected when tokens expire:', error.message);
        setUser(null);
      } else {
        setUser(session?.user ?? null);
      }
    } catch (error) {
      console.error('Error refetching session:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.log('Session invalidated - this is expected when tokens expire:', error.message);
          
          // Check for refresh token errors and clear localStorage
          if (error.message.includes('Invalid Refresh Token')) {
            // Clear all Supabase-related keys from localStorage
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('sb-')) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
          }
          
          // Clear any stale auth state
          await supabase.auth.signOut();
          if (mounted) {
            setUser(null);
          }
        } else {
          if (mounted) {
            setUser(session?.user ?? null);
          }
        }
      } catch (error) {
        console.error('Error getting session:', error);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        
        if (!mounted) return;

        if (event === 'TOKEN_REFRESHED' && !session) {
          // If token refresh failed and session is null, sign out to clear stale tokens
          await supabase.auth.signOut();
          setUser(null);
        } else if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
        } else {
          setUser(session.user);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      // Handle cases where session is already missing/invalid
      if (error && (
        error.message.includes('Auth session missing!') || 
        error.message.includes('session_not_found')
      )) {
        // Session is already gone, just clear client state
        setUser(null);
        return { error: null };
      }
      
      if (error) throw error;
      
      setUser(null);
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, signOut, refetch };
}