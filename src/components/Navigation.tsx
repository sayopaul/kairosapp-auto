import React, { useState } from 'react';
import { NavigationTab } from '../types';
import {
  Home, ArrowLeftRight, Heart, FileCheck, Zap,
  Folder, MessageCircle, User, LogIn, LogOut, Crown, Bell, Menu, X
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
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile(user?.id);
  const [showAuth, setShowAuth] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const handleTabClick = (tab: NavigationTab) => {
    onTabChange(tab);
    setMenuOpen(false); // Close menu on mobile when navigating
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onTabChange('dashboard');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          {/* Logo + Tagline */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img src="/logo.png" alt="AutoTradeTCG Logo" className="h-12 w-auto" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
            </div>
            <div className="hidden md:block border-l border-gray-300 pl-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Your Collection. Your Rules.</div>
              <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Our System.</div>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <button onClick={() => setMenuOpen(!menuOpen)} className="text-gray-700 focus:outline-none">
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Desktop Nav Items */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleTabClick(id)}
                className={`flex items-center space-x-2 px-4 py-3 rounded-xl transition-all duration-300 ${
                  activeTab === id
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50 hover:shadow-md'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{label}</span>
              </button>
            ))}

            {user && (
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className="flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-lg ml-2"
              >
                <Crown className="h-4 w-4" />
                <span className="font-medium">
                  {profile?.subscription_tier === 'trainer' ? 'Upgrade' : profile?.subscription_tier}
                </span>
              </button>
            )}

            {user && <div className="ml-2"><NotificationCenter /></div>}

            <div className="ml-4 pl-4 border-l border-gray-200">
              {user ? (
                <button onClick={handleSignOut} className="flex items-center space-x-2 px-4 py-3 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200">
                  <LogOut className="h-4 w-4" />
                  <span className="font-medium">Sign Out</span>
                </button>
              ) : (
                <button onClick={() => setShowAuth(true)} className="flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl">
                  <LogIn className="h-4 w-4" />
                  <span className="font-medium">Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu Items */}
        {menuOpen && (
          <div className="md:hidden px-4 pb-4 space-y-2">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleTabClick(id)}
                className={`w-full flex items-center space-x-2 px-4 py-3 rounded-xl transition-all duration-300 ${
                  activeTab === id
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50 hover:shadow-md'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{label}</span>
              </button>
            ))}

            {user && (
              <button onClick={() => setShowSubscriptionModal(true)} className="w-full flex items-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-xl shadow hover:bg-purple-700">
                <Crown className="h-4 w-4" />
                <span className="font-medium">
                  {profile?.subscription_tier === 'trainer' ? 'Upgrade' : profile?.subscription_tier}
                </span>
              </button>
            )}

            {user && <NotificationCenter />}

            {user ? (
              <button onClick={handleSignOut} className="w-full flex items-center space-x-2 px-4 py-3 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200">
                <LogOut className="h-4 w-4" />
                <span className="font-medium">Sign Out</span>
              </button>
            ) : (
              <button onClick={() => setShowAuth(true)} className="w-full flex items-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow">
                <LogIn className="h-4 w-4" />
                <span className="font-medium">Sign In</span>
              </button>
            )}
          </div>
        )}
      </nav>

      {/* Modals */}
      {showAuth && (
        <Auth onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />
      )}
      {showSubscriptionModal && (
        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          currentTier={profile?.subscription_tier || 'trainer'}
        />
      )}
    </>
  );
};

export default Navigation;
