import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, LogIn, UserPlus, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthProps {
  onClose?: () => void;
  onSuccess?: () => void;
  initialMode?: 'login' | 'register';
}

const Auth: React.FC<AuthProps> = ({ onClose, onSuccess, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    confirmPassword: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setMessage(null);
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setMessage({ type: 'error', text: 'Email is required' });
      return false;
    }

    if (!formData.email.includes('@')) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return false;
    }

    if (!formData.password) {
      setMessage({ type: 'error', text: 'Password is required' });
      return false;
    }

    if (formData.password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return false;
    }

    if (mode === 'register') {
      if (!formData.username.trim()) {
        setMessage({ type: 'error', text: 'Username is required' });
        return false;
      }

      if (formData.username.length < 3) {
        setMessage({ type: 'error', text: 'Username must be at least 3 characters' });
        return false;
      }

      if (formData.username.length > 20) {
        setMessage({ type: 'error', text: 'Username must be 20 characters or less' });
        return false;
      }

      // Check for valid username characters (alphanumeric, underscore, hyphen)
      if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
        setMessage({ type: 'error', text: 'Username can only contain letters, numbers, underscores, and hyphens' });
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        setMessage({ type: 'error', text: 'Passwords do not match' });
        return false;
      }
    }

    return true;
  };

  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (error) {
        console.error('Error checking username availability:', error);
        return false;
      }

      if (data === null) {
        // No rows returned, username is available
        return true;
      }

      if (data) {
        // Username already exists
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking username availability:', error);
      return false;
    }
  };

  const createUserProfile = async (userId: string, username: string, email: string) => {
    try {
      console.log('Creating user profile for:', userId, username);
      
      // First, check if a profile already exists and delete it
      const { data: existingProfile } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (existingProfile) {
        console.log('Deleting existing profile for user:', userId);
        await supabase
          .from('users')
          .delete()
          .eq('id', userId);
      }

      // Create new profile with the chosen username
      const { error: profileError } = await supabase
        .from('users')
        .insert([{
          id: userId,
          username: username, // Use the chosen username
          email: email,
          total_trades: 0,
          match_success_rate: 0,
          average_value_traded: 0,
          reputation_score: 5.0,
          shipping_preference: 'direct',
          trade_percentage_min: 80,
        }]);

      if (profileError) {
        console.error('Error creating profile:', profileError);
        throw profileError;
      }

      console.log('Profile created successfully with username:', username);
    } catch (error) {
      console.error('Profile creation failed:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setMessage(null);

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        setMessage({ type: 'success', text: 'Successfully logged in!' });
        
        setTimeout(() => {
          onSuccess?.();
        }, 1000);

      } else {
        // Check username availability before creating account
        const isUsernameAvailable = await checkUsernameAvailability(formData.username);
        
        if (!isUsernameAvailable) {
          setMessage({ type: 'error', text: 'Username is already taken. Please choose a different username.' });
          setIsLoading(false);
          return;
        }

        // Register new user
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              username: formData.username,
            },
            emailRedirectTo: `https://autotradetcg.com/confirm`
          }
        });

        if (error) throw error;

        if (data.user) {
          // Check if user needs email confirmation
          if (!data.session) {
            setEmailSent(true);
            setMessage({ 
              type: 'info', 
              text: 'Please check your email and click the confirmation link to complete your registration.' 
            });
            return;
          }

          // If user is immediately confirmed, create profile with chosen username
          try {
            await createUserProfile(data.user.id, formData.username, formData.email);
            
            setMessage({ 
              type: 'success', 
              text: 'Account created successfully! You can now log in.' 
            });

            // Switch to login mode after successful registration
            setTimeout(() => {
              setMode('login');
              setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
            }, 2000);

          } catch (profileError) {
            console.error('Profile creation error:', profileError);
            setMessage({ 
              type: 'error', 
              text: 'Account created but profile setup failed. Please try logging in.' 
            });
            
            setTimeout(() => {
              setMode('login');
              setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
            }, 2000);
          }
        }
      }

    } catch (error: any) {
      console.error('Auth error:', error);
      
      let errorMessage = 'An unexpected error occurred';
      
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password';
      } else if (error.message.includes('User already registered')) {
        errorMessage = 'An account with this email already exists';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and click the confirmation link before logging in';
        setEmailSent(true);
      } else if (error.message.includes('Signup not allowed')) {
        errorMessage = 'Registration is currently disabled. Please contact support.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!formData.email) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: formData.email,
        options: {
          emailRedirectTo: `https://autotradetcg.com/confirm`
        }
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Confirmation email sent! Please check your inbox.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to resend confirmation email' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      // Use a demo account with a real email format
      const demoEmail = 'demo@autotradetcg.com';
      const demoPassword = 'demo123456';

      // Try to sign in with demo account
      const { data, error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (error) {
        // If demo account doesn't exist, create it
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
          options: {
            data: {
              username: 'DemoUser',
            }
          }
        });

        if (signUpError) throw signUpError;

        if (signUpData.user) {
          // Check if user needs email confirmation
          if (!signUpData.session) {
            setMessage({ 
              type: 'info', 
              text: 'Demo account created but requires email confirmation. Please check the demo email or contact support for immediate access.' 
            });
            return;
          }
          
          // Create demo profile
          await createUserProfile(signUpData.user.id, 'DemoUser', demoEmail);
          setMessage({ type: 'success', text: 'Demo account created and activated!' });
        }
      } else {
        setMessage({ type: 'success', text: 'Demo account activated!' });
      }
      
      setTimeout(() => {
        onSuccess?.();
      }, 1000);

    } catch (error) {
      console.error('Demo login error:', error);
      
      let errorMessage = 'Failed to activate demo account';
      
      if (error.message && error.message.includes('Invalid login credentials')) {
        errorMessage = 'Demo account requires email confirmation. Please contact support for immediate access.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl">
                {mode === 'login' ? (
                  <LogIn className="h-6 w-6 text-white" />
                ) : (
                  <UserPlus className="h-6 w-6 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-blue-100">
                  {mode === 'login' 
                    ? 'Sign in to your AutoTradeTCG account' 
                    : 'Join the AutoTradeTCG community'
                  }
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
              >
                <span className="text-white text-xl">×</span>
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="p-6">
          {/* Message Display */}
          {message && (
            <div className={`flex items-center space-x-3 p-4 rounded-lg border mb-6 ${
              message.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : message.type === 'info'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
              ) : message.type === 'info' ? (
                <Clock className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          {/* Email Confirmation Notice */}
          {emailSent && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-3 mb-3">
                <Clock className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-800">Email Confirmation Required</h3>
              </div>
              <p className="text-blue-700 text-sm mb-3">
                We've sent a confirmation link to <strong>{formData.email}</strong>. 
                Please check your email and click the link to activate your account.
              </p>
              <button
                onClick={handleResendConfirmation}
                disabled={isLoading}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm underline disabled:opacity-50"
              >
                Resend confirmation email
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username (Register only) */}
            {mode === 'register' && (
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                  Username *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Choose a unique username"
                    required
                    minLength={3}
                    maxLength={20}
                    pattern="[a-zA-Z0-9_-]+"
                    title="Username can only contain letters, numbers, underscores, and hyphens"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  3-20 characters. Letters, numbers, underscores, and hyphens only.
                </p>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {mode === 'register' && (
                <p className="text-xs text-gray-500 mt-1">
                  Minimum 6 characters required
                </p>
              )}
            </div>

            {/* Confirm Password (Register only) */}
            {mode === 'register' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{mode === 'login' ? 'Signing In...' : 'Creating Account...'}</span>
                </>
              ) : (
                <>
                  {mode === 'login' ? (
                    <LogIn className="h-5 w-5" />
                  ) : (
                    <UserPlus className="h-5 w-5" />
                  )}
                  <span className="font-medium">
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Mode Toggle */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setMessage(null);
                  setEmailSent(false);
                  setFormData({ email: '', password: '', username: '', confirmPassword: '' });
                }}
                className="ml-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* Demo Option */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <User className="h-5 w-5" />
              <span className="font-medium">Try Demo Account</span>
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
              No registration required • Explore all features
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;