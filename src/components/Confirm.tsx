import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Confirm() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    console.log("Confirm page mounted", window.location.href);
    const confirmEmail = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) {
        setStatus('error');
        setMessage('Invalid or expired confirmation link.');
      } else {
        setStatus('success');
        setMessage('Email confirmed! Redirecting...');
        setTimeout(() => navigate('/'), 2000);
      }
    };

    // Give time for hash to load
    setTimeout(() => {
      if (window.location.href.includes('#') || window.location.href.includes('access_token')) {
        confirmEmail();
      } else {
        setStatus('error');
        setMessage('No confirmation token found in the URL.');
      }
    }, 100);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center p-6 bg-white shadow-lg rounded-xl">
        <h1 className="text-2xl font-bold mb-4">Email Confirmation</h1>
        <p className="text-gray-700">{message}</p>
      </div>
    </div>
  );
}