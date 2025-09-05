import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  TrendingUp, 
  Award, 
  Settings, 
  Shield, 
  Bell,
  LogOut,
  Edit3,
  LogIn,
  Save,
  X,
  Upload,
  Camera,
  Crown,
  CheckCircle,
  Calendar,
  ArrowLeftRight
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import Auth from './Auth';
import { useSubscription } from '../hooks/useSubscription';
import SubscriptionModal from './SubscriptionModal';

const Profile: React.FC = () => {
  const { user, signOut } = useAuth();
  const { profile, updateProfile, loading, completedTrades } = useUserProfile(user?.id);
  const { subscription, cancelSubscription } = useSubscription(user?.id);
  const [showAuth, setShowAuth] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const [tradePercentage, setTradePercentage] = useState(profile?.trade_percentage_min || 80);
  const [shippingPreference, setShippingPreference] = useState(profile?.shipping_preference || 'direct');
  
  // Username editing state
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(profile?.username || '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);

  // Profile picture editing state
  const [isEditingProfilePicture, setIsEditingProfilePicture] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState(profile?.profile_image_url || '');
  const [profilePictureError, setProfilePictureError] = useState<string | null>(null);
  const [savingProfilePicture, setSavingProfilePicture] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  // Update local state when profile changes
  React.useEffect(() => {
    if (profile) {
      setNewUsername(profile.username);
      setTradePercentage(profile.trade_percentage_min);
      setShippingPreference(profile.shipping_preference);
      setProfilePictureUrl(profile.profile_image_url || '');
    }
  }, [profile]);

  const handleUpdatePreferences = async () => {
    if (!profile) return;
    
    try {
      await updateProfile({
        trade_percentage_min: tradePercentage,
        shipping_preference: shippingPreference,
      });
    } catch (error) {
      console.error('Failed to update preferences:', error);
    }
  };

  const handleUsernameEdit = () => {
    setIsEditingUsername(true);
    setNewUsername(profile?.username || '');
    setUsernameError(null);
  };

  const handleUsernameSave = async () => {
    if (!profile || !newUsername.trim()) {
      setUsernameError('Username cannot be empty');
      return;
    }

    // Validate username
    if (newUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    if (newUsername.length > 20) {
      setUsernameError('Username must be 20 characters or less');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
      setUsernameError('Username can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    setSavingUsername(true);
    setUsernameError(null);

    try {
      await updateProfile({
        username: newUsername.trim(),
      });
      setIsEditingUsername(false);
    } catch (error) {
      console.error('Failed to update username:', error);
      if (error instanceof Error && error.message.includes('duplicate')) {
        setUsernameError('Username is already taken');
      } else {
        setUsernameError('Failed to update username. Please try again.');
      }
    } finally {
      setSavingUsername(false);
    }
  };

  const handleUsernameCancel = () => {
    setIsEditingUsername(false);
    setNewUsername(profile?.username || '');
    setUsernameError(null);
  };

  const handleProfilePictureEdit = () => {
    setIsEditingProfilePicture(true);
    setProfilePictureUrl(profile?.profile_image_url || '');
    setProfilePictureError(null);
  };

  const handleProfilePictureSave = async () => {
    if (!profile) return;

    // Validate URL if provided
    if (profilePictureUrl && !isValidImageUrl(profilePictureUrl)) {
      setProfilePictureError('Please enter a valid image URL');
      return;
    }

    setSavingProfilePicture(true);
    setProfilePictureError(null);

    try {
      await updateProfile({
        profile_image_url: profilePictureUrl || null,
      });
      setIsEditingProfilePicture(false);
    } catch (error) {
      console.error('Failed to update profile picture:', error);
      setProfilePictureError('Failed to update profile picture. Please try again.');
    } finally {
      setSavingProfilePicture(false);
    }
  };

  const handleProfilePictureCancel = () => {
    setIsEditingProfilePicture(false);
    setProfilePictureUrl(profile?.profile_image_url || '');
    setProfilePictureError(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setProfilePictureError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setProfilePictureError('Image must be smaller than 5MB');
      return;
    }

    setUploadingFile(true);
    setProfilePictureError(null);

    try {
      // Convert file to base64 data URL for demo purposes
      // In a real app, you'd upload to a service like Supabase Storage, Cloudinary, etc.
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setProfilePictureUrl(result);
        setUploadingFile(false);
      };
      reader.onerror = () => {
        setProfilePictureError('Failed to read file');
        setUploadingFile(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Failed to upload image:", error);
      setProfilePictureError('Failed to upload image');
      setUploadingFile(false);
    }
  };

  const isValidImageUrl = (url: string): boolean => {
    try {
      // Check if it's a base64 data URL
      if (url.startsWith("data:image/")) {
        return true;
      }

      // Check if it's a regular URL with image extension
      new URL(url);
      return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
    } catch {
      return false;
    }
  };

  const getProfileImageSrc = () => {
    return profilePictureUrl || profile?.profile_image_url || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2';
  };

  const handleCancelSubscription = async () => {
    if (!user) return;
    
    if (window.confirm('Are you sure you want to cancel your subscription? You will be downgraded to the free tier at the end of your billing period.')) {
      try {
        const success = await cancelSubscription();
        if (success) {
          alert('Your subscription has been cancelled. You will be downgraded to the free tier at the end of your billing period.');
        } else {
          alert('Failed to cancel subscription. Please try again.');
        }
      } catch (error) {
        console.error('Error cancelling subscription:', error);
        alert('An error occurred while cancelling your subscription.');
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 opacity-10 rounded-full -translate-y-32 translate-x-32"></div>
            <div className="relative z-10 text-center">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 mx-auto mb-6">
                <User className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold mb-4">Profile Access Required</h1>
              <p className="text-gray-300 text-lg mb-8">
                Sign in to view and manage your profile settings
              </p>
              <button
                onClick={() => setShowAuth(true)}
                className="inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl text-lg font-semibold"
              >
                <LogIn className="h-6 w-6" />
                <span>Sign In</span>
              </button>
            </div>
          </div>
        </div>

        {showAuth && (
          <Auth
            onClose={() => setShowAuth(false)}
            onSuccess={() => setShowAuth(false)}
          />
        )}
      </>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="bg-red-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <User className="h-10 w-10 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Profile not found</h3>
          <p className="text-gray-600">There was an issue loading your profile</p>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Total Trades', value: profile.total_trades, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Success Rate', value: `${profile.match_success_rate}%`, icon: Award, color: 'text-gray-600' },
    { label: 'Avg Trade Value', value: `$${profile.average_value_traded}`, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Reputation', value: profile.reputation_score.toFixed(1), icon: Award, color: 'text-gray-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 opacity-10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="relative z-10">
          <div className="flex items-center space-x-6">
            {/* Profile Picture Section */}
            <div className="relative group">
              {isEditingProfilePicture ? (
                <div className="w-24 h-24 rounded-full border-4 border-white/20 bg-white/10 flex items-center justify-center">
                  {uploadingFile ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  ) : (
                    <Camera className="h-8 w-8 text-white/60" />
                  )}
                </div>
              ) : (
                <img
                  src={getProfileImageSrc()}
                  alt={profile.username}
                  className="w-24 h-24 rounded-full border-4 border-white/20 object-cover"
                />
              )}
              
              {!isEditingProfilePicture ? (
                <button 
                  onClick={handleProfilePictureEdit}
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors duration-200 opacity-0 group-hover:opacity-100"
                >
                  <Edit3 className="h-4 w-4 text-white" />
                </button>
              ) : (
                <div className="absolute bottom-0 right-0 flex space-x-1">
                  <button
                    onClick={handleProfilePictureSave}
                    disabled={savingProfilePicture}
                    className="p-2 bg-green-600 hover:bg-green-700 rounded-full transition-colors duration-200 disabled:opacity-50"
                  >
                    {savingProfilePicture ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Save className="h-4 w-4 text-white" />
                    )}
                  </button>
                  <button
                    onClick={handleProfilePictureCancel}
                    className="p-2 bg-red-600 hover:bg-red-700 rounded-full transition-colors duration-200"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex-1">
              {/* Editable Username */}
              <div className="mb-2">
                {isEditingUsername ? (
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="text-3xl font-bold bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Enter username"
                      maxLength={20}
                    />
                    <button
                      onClick={handleUsernameSave}
                      disabled={savingUsername}
                      className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors duration-200 disabled:opacity-50"
                    >
                      {savingUsername ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Save className="h-4 w-4 text-white" />
                      )}
                    </button>
                    <button
                      onClick={handleUsernameCancel}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <h1 className="text-3xl font-bold">{profile.username}</h1>
                    <button
                      onClick={handleUsernameEdit}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors duration-200"
                    >
                      <Edit3 className="h-4 w-4 text-white" />
                    </button>
                  </div>
                )}
                {usernameError && (
                  <p className="text-red-300 text-sm mt-1">{usernameError}</p>
                )}
              </div>
              
              <div className="flex items-center space-x-4 text-gray-300">
                <div className="flex items-center space-x-1">
                  <Mail className="h-4 w-4" />
                  <span>{profile.email || 'No email provided'}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Profile Picture Editing Panel */}
          {isEditingProfilePicture && (
            <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">Update Profile Picture</h3>
              
              {profilePictureError && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-200 text-sm">{profilePictureError}</p>
                </div>
              )}
              
              <div className="space-y-4">
                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Upload Image File
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg cursor-pointer transition-colors duration-200">
                      <Upload className="h-4 w-4 text-white" />
                      <span className="text-white text-sm">Choose File</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploadingFile}
                      />
                    </label>
                    <span className="text-white/60 text-xs">Max 5MB • JPG, PNG, GIF, WebP</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex-1 h-px bg-white/20"></div>
                  <span className="text-white/60 text-sm">OR</span>
                  <div className="flex-1 h-px bg-white/20"></div>
                </div>
                
                {/* URL Input */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={profilePictureUrl}
                    onChange={(e) => setProfilePictureUrl(e.target.value)}
                    placeholder="https://example.com/your-image.jpg"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                
                {/* Preview */}
                {profilePictureUrl && (
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Preview
                    </label>
                    <div className="flex items-center space-x-4">
                      <img
                        src={profilePictureUrl}
                        alt="Preview"
                        className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
                        onError={() => setProfilePictureError('Invalid image URL')}
                      />
                      <div className="text-white/80 text-sm">
                        This is how your profile picture will appear
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center space-x-3 mb-2">
                <Icon className={`h-6 w-6 ${stat.color}`} />
                <h3 className="font-semibold text-gray-700">{stat.label}</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>
      
      {/* Subscription Information */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 mb-6">
        <div className="flex items-center space-x-2 mb-6">
          <Crown className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">Subscription Status</h2>
        </div>
        
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Current Plan:</h3>
              <p className="text-lg font-bold text-purple-700 capitalize">
                {profile?.subscription_tier === 'trainer' ? 'Free Tier' : 
                 profile?.subscription_tier === 'elite' ? 'Elite Trainer' : 
                 profile?.subscription_tier === 'master' ? 'Master Collector' : 
                 'Free Tier'}
              </p> 
              <p className="text-sm text-gray-600 mt-1">
                {profile?.subscription_status === 'active' ? 'Active subscription' : 
                 profile?.subscription_status === 'cancelled' ? 'Cancelled - Access until end of billing period' : 
                 'Free access'}
              </p>
            </div>
            
            <div className="space-y-2"> 
              <button
                onClick={() => setShowSubscription(true)}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
              >
                {profile?.subscription_tier === 'trainer' ? 'Upgrade Plan' : 'Change Plan'}
              </button>
              
              {profile?.subscription_tier !== 'trainer' && (profile?.subscription_status === 'active' || profile?.subscription_status === null) && (
                <button
                  onClick={handleCancelSubscription}
                  className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors duration-200"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          <p>Manage your subscription to access premium features like unlimited cards, advanced matching, and more.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Preferences */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-6">
            <Settings className="h-6 w-6 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Preferences</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trade Acceptable Percentage
              </label>
              <select
                value={tradePercentage}
                onChange={(e) => setTradePercentage(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={70}>Within 70% market value</option>
                <option value={80}>Within 80% market value</option>
                <option value={85}>Within 85% market value</option>
                <option value={90}>Within 90% market value</option>
                <option value={95}>Within 95% market value</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shipping Preference
              </label>
              <select
                value={shippingPreference}
                onChange={(e) => setShippingPreference(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="local">Local Pickup</option>
                <option value="direct">Direct (User to User)</option>
                <option value="third-party">3rd Party (via AutoTradeTCG)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                3rd party shipping provides authentication and condition verification
              </p>
            </div>

            <button 
              onClick={handleUpdatePreferences}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Save Preferences
            </button>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-6">
            <Shield className="h-6 w-6 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Security & Notifications</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Bell className="h-5 w-5 text-gray-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Push Notifications</h3>
                  <p className="text-sm text-gray-600">Get notified about new matches and messages</p>
                </div>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  notifications ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                    notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-gray-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-600">Add an extra layer of security</p>
                </div>
              </div>
              <button
                onClick={() => setTwoFactor(!twoFactor)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  twoFactor ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                    twoFactor ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
              Change Password
            </button>

            <button 
              onClick={handleSignOut}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Completed Trades Section */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center space-x-2 mb-6">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900">Completed Trades</h2>
        </div>
        
        {completedTrades.length === 0 ? (
          <div className="text-center py-8">
            <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <ArrowLeftRight className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No completed trades yet</h3>
            <p className="text-gray-600">Your completed trades will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {completedTrades.map((trade) => {
              const isProposer = trade.proposer_id === user?.id;
              const otherUser = isProposer ? trade.match?.user2 : trade.match?.user1;
              const myCard = isProposer ? trade.match?.user1_card : trade.match?.user2_card;
              const theirCard = isProposer ? trade.match?.user2_card : trade.match?.user1_card;
              
              return (
                <div key={trade.id} className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <img
                        src={otherUser?.profile_image_url || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2'}
                        alt={otherUser?.username || 'User'}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          Trade with {otherUser?.username || 'Unknown User'}
                        </h4>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Completed {trade.completed_at ? new Date(trade.completed_at).toLocaleDateString() : 'Recently'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      <CheckCircle className="h-4 w-4" />
                      <span>Completed</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <h5 className="font-medium text-gray-900 mb-2">You Traded</h5>
                      {myCard ? (
                        <div className="flex items-center space-x-3">
                          <img
                            src={myCard.image_url || 'https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2'}
                            alt={myCard.name}
                            className="w-12 h-16 object-cover rounded shadow-sm"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{myCard.name}</p>
                            <p className="text-sm text-gray-600">{myCard.set}</p>
                            <p className="text-sm font-bold text-blue-600">
                              ${parseFloat(myCard.market_price || '0').toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-500">Card details unavailable</p>
                      )}
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <h5 className="font-medium text-gray-900 mb-2">You Received</h5>
                      {theirCard ? (
                        <div className="flex items-center space-x-3">
                          <img
                            src={theirCard.image_url || 'https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2'}
                            alt={theirCard.name}
                            className="w-12 h-16 object-cover rounded shadow-sm"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{theirCard.name}</p>
                            <p className="text-sm text-gray-600">{theirCard.set}</p>
                            <p className="text-sm font-bold text-green-600">
                              ${parseFloat(theirCard.market_price || '0').toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-500">Card details unavailable</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Subscription Modal */}
      {showSubscription && (
        <SubscriptionModal
          isOpen={true}
          onClose={() => setShowSubscription(false)}
          currentTier={profile?.subscription_tier || 'trainer'}
        />
      )}
    </div>
  );
};

export default Profile;