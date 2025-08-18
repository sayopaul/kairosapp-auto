import React, { useEffect, useState } from 'react';
import { CheckCircle, Loader2, AlertCircle, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Confirm: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        setStatus('loading');
        setMessage('Confirming your email address...');

        // Wait a moment for the URL to fully load
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const currentUrl = window.location.href;
        console.log('Current URL for confirmation:', currentUrl);
        
        // Check for confirmation parameters in both URL and hash
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        const code = urlParams.get('code') || hashParams.get('code');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const tokenHash = urlParams.get('token_hash') || hashParams.get('token_hash');
        const type = urlParams.get('type') || hashParams.get('type');
        
        console.log('URL parameters:', { code, accessToken, refreshToken, tokenHash, type });
        
        // Try different confirmation methods based on available parameters
        let data, error;
        
        if (code) {
          // Use code-based confirmation
          console.log('Using code-based confirmation');
          const result = await supabase.auth.exchangeCodeForSession(currentUrl);
          data = result.data;
          error = result.error;
        } else if (accessToken && refreshToken) {
          // Use token-based confirmation
          console.log('Using token-based confirmation');
          const result = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          data = result.data;
          error = result.error;
        } else if (tokenHash && type === 'signup') {
          // Use token hash confirmation
          console.log('Using token hash confirmation');
          const result = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'signup'
          });
          data = result.data;
          error = result.error;
        } else {
          setStatus('error');
          setMessage('Invalid confirmation link. Missing required parameters.');
          return;
        }

        if (error) {
          console.error('Email confirmation error:', error);
          setStatus('error');
          
          // Provide specific error messages
          if (error.message.includes('expired')) {
            setMessage('This confirmation link has expired. Please request a new confirmation email.');
          } else if (error.message.includes('invalid')) {
            setMessage('This confirmation link is invalid. Please check your email for the correct link.');
          } else if (error.message.includes('already_confirmed')) {
            setMessage('This email has already been confirmed. You can now sign in to your account.');
            setStatus('success');
          } else if (error.message.includes('already confirmed')) {
            setMessage('This email has already been confirmed. You can now sign in to your account.');
            setStatus('success');
          } else {
            setMessage(error.message || 'Failed to confirm email address');
          }
          return;
        }

        if (data.session && data.user) {
          console.log('Email confirmation successful:', data.user.email);
          setStatus('success');
          setMessage('Email confirmed successfully! Welcome to AutoTradeTCG!');
          
          // Redirect to home page after a short delay
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        } else {
          setStatus('error');
          setMessage('Email confirmation completed but no session was created. Please try signing in.');
        }
      } catch (error) {
        console.error('Unexpected error during email confirmation:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again or contact support.');
      }
    };

    // Run confirmation when component mounts
    confirmEmail();
  }, []);

  const handleReturnHome = () => {
    window.location.href = '/';
  };

  const handleRequestNewLink = () => {
    window.location.href = '/?auth=register';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white text-center">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 mx-auto mb-6">
              {status === 'loading' && (
                <Loader2 className="h-10 w-10 text-white animate-spin" />
              )}
              {status === 'success' && (
                <CheckCircle className="h-10 w-10 text-white" />
              )}
              {status === 'error' && (
                <AlertCircle className="h-10 w-10 text-white" />
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2">Email Confirmation</h1>
            <p className="text-blue-100">
              {status === 'loading' && 'Verifying your email address...'}
              {status === 'success' && 'Welcome to AutoTradeTCG!'}
              {status === 'error' && 'Confirmation Issue'}
            </p>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Status Message */}
            <div className={`flex items-center space-x-3 p-4 rounded-lg border mb-6 ${
              status === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : status === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              {status === 'loading' && (
                <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
              )}
              {status === 'success' && (
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
              )}
              {status === 'error' && (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="font-medium">{message}</span>
            </div>

            {/* Success Content */}
            {status === 'success' && (
              <div className="space-y-4">
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h3 className="font-semibold text-green-900 mb-2">Account Activated!</h3>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Your email has been verified</li>
                    <li>• Your account is now fully activated</li>
                    <li>• You can start trading cards immediately</li>
                    <li>• Welcome to the AutoTradeTCG community!</li>
                  </ul>
                </div>
                
                <div className="text-center">
                  <div className="animate-pulse text-blue-600 text-sm">
                    Redirecting you to the home page...
                  </div>
                </div>
              </div>
            )}

            {/* Error Content */}
            {status === 'error' && (
              <div className="space-y-4">
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <h3 className="font-semibold text-red-900 mb-2">What you can try:</h3>
                  <ul className="text-sm text-red-800 space-y-1">
                    <li>• Check if the confirmation link is complete</li>
                    <li>• Make sure you're using the latest email</li>
                    <li>• Try requesting a new confirmation email</li>
                    <li>• Contact support if the problem persists</li>
                  </ul>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleRequestNewLink}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl text-sm font-medium"
                  >
                    Request New Link
                  </button>
                  <button
                    onClick={handleReturnHome}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 text-sm font-medium"
                  >
                    Return Home
                  </button>
                </div>
              </div>
            )}

            {/* Loading Content */}
            {status === 'loading' && (
              <div className="text-center">
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-sm text-blue-800">
                      Please wait while we verify your email address. This should only take a moment.
                    </p>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <div className="flex items-center justify-center space-x-2 text-gray-500">
            <img 
              src="/logo.png" 
              alt="AutoTradeTCG Logo" 
              className="h-6 w-auto opacity-75"
            />
            <span className="text-sm">AutoTradeTCG</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Your Collection. Your Rules. Our System.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Confirm;