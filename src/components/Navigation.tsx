import React, { useState } from 'react';
import { NavigationTab } from '../types';
import { 
  Home, 
  ArrowLeftRight, 
  Heart,
  FileCheck,
  Zap, 
  Folder, 
  MessageCircle, 
  User, 
  LogIn,
  LogOut, 
  Crown,
  Bell
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import Auth from './Auth';
import SubscriptionModal from './SubscriptionModal';
import NotificationCenter from './NotificationCenter';

interface NavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  console.log('Navigation: Current activeTab:', activeTab);
  
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile(user?.id);
  const [showAuth, setShowAuth] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const navItems = [
    { id: 'dashboard' as NavigationTab, label: 'Dashboard', icon: Home },
    { id: 'trades' as NavigationTab, label: 'Trades', icon: ArrowLeftRight },
    { id: 'want' as NavigationTab, label: 'Want', icon: Heart },
    { id: 'matches' as NavigationTab, label: 'Matches', icon: Zap },
    { id: 'proposals' as NavigationTab, label: 'Proposals', icon: FileCheck },
    { id: 'collection' as NavigationTab, label: 'Collection', icon: Folder },
    { id: 'chat' as NavigationTab, label: 'Chat', icon: MessageCircle },
    { id: 'profile' as NavigationTab, label: 'Profile', icon: User },
  ];

  const handleAuthSuccess = () => {
    setShowAuth(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onTabChange('dashboard');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleTabClick = (tab: NavigationTab) => {
    console.log('Navigation: Tab clicked:', tab);
    onTabChange(tab);
  };

  return (
    <>
      <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-20">
            {/* Brand Section */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <img 
                    src="/logo.png" 
                    alt="AutoTradeTCG Logo" 
                    className="h-12 w-auto"
                  />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
                </div>
                <div className="hidden md:block border-l border-gray-300 pl-4">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Your Collection. Your Rules.
                  </div>
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    Our System.
                  </div>
                </div>
              </div>
            </div>
            
            {/* Navigation Items */}
            <div className="flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`flex items-center space-x-2 px-4 py-3 rounded-xl transition-all duration-300 ${
                      activeTab === item.id
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-200 transform scale-105'
                        : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50 hover:shadow-md'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}

              {/* Upgrade Button */}
              {user && (
                <button
                  onClick={() => setShowSubscriptionModal(true)}
                  className="flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-lg hover:shadow-xl ml-2"
                >
                  {profile?.subscription_tier === 'trainer' ? (
                    <>
                      <Crown className="h-4 w-4" />
                      <span className="font-medium">Upgrade</span>
                    </>
                  ) : (
                    <>
                      <Crown className="h-4 w-4" />
                      <span className="font-medium">
                        {profile?.subscription_tier === 'elite' ? 'Elite' : 'Master'}
                      </span>
                    </>
                  )}
                </button>
              )}

              {/* Notifications */}
              {user && (
                <div className="ml-2">
                  <NotificationCenter />
                </div>
              )}


              {/* Auth Button */}
              <div className="ml-4 pl-4 border-l border-gray-200">
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="flex items-center space-x-2 px-4 py-3 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAuth(true)}
                    className="flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <LogIn className="h-4 w-4" />
                    <span className="font-medium">Sign In</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Auth Modal */}
      {showAuth && (
        <Auth
          onClose={() => setShowAuth(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={() => {
            setShowSubscriptionModal(false);
          }}
          currentTier={profile?.subscription_tier || 'trainer'}
        />
      )}
    </>
  );
};

export default Navigation;