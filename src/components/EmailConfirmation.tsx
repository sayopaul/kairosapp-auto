import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const EmailConfirmation: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Confirming your email address...');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const currentUrl = window.location.href;
        const urlParams = new URLSearchParams(location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        const code = urlParams.get('code') || hashParams.get('code');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const tokenHash = urlParams.get('token_hash') || hashParams.get('token_hash');
        const type = urlParams.get('type') || hashParams.get('type');

        if (!code && !accessToken && !tokenHash) {
          setStatus('error');
          setMessage('Invalid confirmation link. Missing required parameters.');
          return;
        }

        let data, error;

        if (code) {
          const result = await supabase.auth.exchangeCodeForSession(currentUrl);
          data = result.data;
          error = result.error;
        } else if (accessToken && refreshToken) {
          const result = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          data = result.data;
          error = result.error;
        } else {
          const result = await supabase.auth.exchangeCodeForSession(currentUrl);
          data = result.data;
          error = result.error;
        }

        if (error) {
          setStatus('error');
          if (error.message.includes('expired')) {
            setMessage('This confirmation link has expired. Please request a new one.');
          } else if (error.message.includes('invalid')) {
            setMessage('This confirmation link is invalid.');
          } else if (error.message.includes('already confirmed')) {
            setMessage('Email already confirmed. You can now sign in.');
          } else {
            setMessage(error.message || 'Email confirmation failed.');
          }
          return;
        }

        if (data.session && data.user) {
          setStatus('success');
          setMessage('Email confirmed successfully! Welcome to AutoTradeTCG!');
          setTimeout(() => navigate('/'), 2000);
        } else {
          setStatus('error');
          setMessage('Email confirmed, but session not created. Please try signing in.');
        }
      } catch (error) {
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again later.');
      }
    };

    confirmEmail();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white text-center">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 mx-auto mb-6">
              {status === 'loading' && <Loader2 className="h-10 w-10 text-white animate-spin" />}
              {status === 'success' && <CheckCircle className="h-10 w-10 text-white" />}
              {status === 'error' && <AlertCircle className="h-10 w-10 text-white" />}
            </div>
            <h1 className="text-3xl font-bold mb-2">Email Confirmation</h1>
            <p className="text-blue-100">
              {status === 'loading' && 'Verifying your email...'}
              {status === 'success' && 'Welcome to AutoTradeTCG!'}
              {status === 'error' && 'Confirmation Issue'}
            </p>
          </div>

          <div className="p-8">
            <div className={`flex items-center space-x-3 p-4 rounded-lg border mb-6 ${
              status === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
              status === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-blue-50 border-blue-200 text-blue-800'}`}>
              {status === 'loading' && <Loader2 className="h-5 w-5 animate-spin" />}
              {status === 'success' && <CheckCircle className="h-5 w-5" />}
              {status === 'error' && <AlertCircle className="h-5 w-5" />}
              <span>{message}</span>
            </div>

            {status === 'success' && (
              <div className="bg-green-50 p-4 border border-green-200 rounded-lg text-green-800 text-sm">
                <p>• Email verified</p>
                <p>• Account activated</p>
                <p>• Welcome to the AutoTradeTCG community!</p>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="bg-red-50 p-4 border border-red-200 rounded-lg text-red-800 text-sm">
                  <p>• Check the confirmation link</p>
                  <p>• Try requesting a new email</p>
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => navigate('/?auth=register')} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm">Request New Link</button>
                  <button onClick={() => navigate('/')} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm">Return Home</button>
                </div>
              </div>
            )}

            {status === 'loading' && (
              <div className="text-center animate-pulse text-blue-600 text-sm">
                Please wait while we confirm your email...
              </div>
            )}
          </div>
        </div>
        <div className="text-center mt-6 text-gray-500 text-sm">
          <img src="/logo.png" alt="AutoTradeTCG Logo" className="h-6 mx-auto opacity-75 mb-2" />
          <p>Your Collection. Your Rules. Our System.</p>
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmation;