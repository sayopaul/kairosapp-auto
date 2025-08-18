import React, { useEffect, useState } from 'react';
import { Plus, Search, Activity, DollarSign, ArrowLeftRight, Heart, TrendingUp, Users, Shield, LogIn, Crown, Star, Zap, Brain, UserPlus, MessageCircle, CreditCard } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import { useCards } from '../hooks/useCards';
import { useSubscription } from '../hooks/useSubscription';
import { useMatching } from '../hooks/useMatching';
import AddCard from './AddCard';
import Auth from './Auth';
import SubscriptionModal from './SubscriptionModal';
import { NavigationTab } from '../types';
import { SubscriptionService } from '../services/subscriptionService';

interface DashboardProps {
  onTabChange: (tab: NavigationTab) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onTabChange }) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, error: profileError, refetch: refetchProfile } = useUserProfile(user?.id);
  const { cards, loading: cardsLoading, error: cardsError } = useCards(user?.id);
  const { subscription } = useSubscription(user?.id);
  const { matches, generateMatches } = useMatching(user?.id);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [subscriptionProcessing, setSubscriptionProcessing] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);

  // Debug logging
  React.useEffect(() => {
    console.log('Dashboard state:', {
      user: user?.id,
      authLoading,
      profileLoading,
      cardsLoading,
      profile: profile?.username,
      cardsCount: cards.length,
      profileError,
      cardsError
    });
  }, [user, authLoading, profileLoading, cardsLoading, profile, cards, profileError, cardsError]);

  const totalValue = cards
    .filter(card => card.list_type === 'trade')
    .reduce((sum, card) => sum + (card.market_price * card.quantity), 0);
  
  const tradeCards = cards.filter(card => card.list_type === 'trade').length;
  const wantCards = cards.filter(card => card.list_type === 'want').length;

  const handleAddCardSuccess = () => {
    setShowAddCard(false);
  };

  const handleAuthSuccess = () => {
    setShowAuth(false);
  };
  
  const handleSubscriptionClose = () => {
    setShowSubscription(false);
    // Refetch profile to get updated subscription status
    if (user) {
      refetchProfile();
    }
  };

  // useEffect(() => {
  //   // Check for Stripe session_id in URL
  //   const urlParams = new URLSearchParams(window.location.search);
  //   const sessionId = urlParams.get('session_id');
  //   if (user && sessionId) {
  //     setSubscriptionProcessing(true);
  //     setSubscriptionError(null);
  //     setSubscriptionSuccess(false);
  //     // Call backend endpoint to verify session and get subscription info
  //     fetch(`/api/stripe/verify-session?session_id=${sessionId}`)
  //       .then(res => res.json())
  //       .then(async (data) => {
  //         if (data.success && data.subscriptionInfo) {
  //           // Create or update subscription in DB
  //           const result = await SubscriptionService.createSubscription(
  //             user.id,
  //             data.subscriptionInfo.tier,
  //             data.subscriptionInfo.billingCycle
  //           );
  //           if (result) {
  //             setSubscriptionSuccess(true);
  //             refetchProfile();
  //           } else {
  //             setSubscriptionError('Failed to update subscription.');
  //           }
  //         } else {
  //           setSubscriptionError('Payment not confirmed or missing subscription info.');
  //         }
  //       })
  //       .catch(() => setSubscriptionError('Failed to verify payment.'))
  //       .finally(() => setSubscriptionProcessing(false));
  //   }
  // }, [user]);

  // Show a success message if redirected from Stripe checkout
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    if (user && sessionId) {
      setSubscriptionSuccess(true);
      // Remove session_id from URL (replaceState avoids page reload)
      urlParams.delete('session_id');
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, [user]);

  const stats = [
    {
      title: 'Collection Value',
      value: `$${totalValue.toFixed(2)}`,
      subtitle: 'Total listed value',
      icon: DollarSign,
      color: 'from-blue-600 to-blue-700',
      onClick: () => onTabChange('collection')
    },
    {
      title: 'Cards for Trade',
      value: tradeCards.toString(),
      subtitle: 'Available to trade',
      icon: ArrowLeftRight,
      color: 'from-gray-600 to-gray-700',
      onClick: () => onTabChange('trades')
    },
    {
      title: 'Wanted Cards',
      value: wantCards.toString(),
      subtitle: 'Cards you want',
      icon: Heart,
      color: 'from-blue-500 to-blue-600',
      onClick: () => onTabChange('want')
    }
  ];

  const quickActions = [
    {
      title: 'Add New Card',
      subtitle: 'Add to your collection',
      icon: Plus,
      color: 'from-blue-600 to-blue-700',
      onClick: () => user ? setShowAddCard(true) : setShowAuth(true)
    },
    {
      title: 'AI Matching',
      subtitle: 'Generate smart trade matches',
      icon: Brain,
      color: 'from-purple-600 to-purple-700',
      onClick: () => user ? generateMatches() : setShowAuth(true)
    },
    {
      title: 'View Matches',
      subtitle: 'See potential trading opportunities',
      icon: Search,
      color: 'from-gray-600 to-gray-700',
      onClick: () => onTabChange('matches')
    }
  ];

  // Show loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error state if there are critical errors
  if (profileError && user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="bg-red-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-10 w-10 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Dashboard Error</h3>
          <p className="text-gray-600 mb-4">There was an issue loading your dashboard</p>
          <p className="text-sm text-red-600 mb-4">{profileError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Reload Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show welcome screen if no user
  if (!user) {
    return (
      <>
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 rounded-3xl p-8 text-white overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full -translate-y-48 translate-x-48"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-600 rounded-full translate-y-32 -translate-x-32"></div>
            </div>
            
            <div className="relative z-10 text-center">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 mx-auto mb-6">
                <Shield className="h-10 w-10 text-white" />
              </div>
              
              <h1 className="text-4xl font-bold mb-4">Welcome to AutoTradeTCG</h1>
              <div className="text-2xl font-bold text-white mb-2">
                Your Collection. Your Rules.
              </div>
              <div className="text-xl font-semibold text-blue-300 mb-6">
                Our System.
              </div>
              <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
                The most trusted platform for trading card enthusiasts. Start building your collection and find perfect trading matches with our AI-powered system.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setShowAuth(true)}
                  className="inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl text-lg font-semibold"
                >
                  <LogIn className="h-6 w-6" />
                  <span>Get Started</span>
                </button>
              </div>
              
              <p className="text-blue-200 text-sm mt-4">
                Join thousands of traders • Free to start
              </p>
            </div>
          </div>

          {/* Features Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-4 rounded-2xl bg-gradient-to-r ${stat.color} shadow-lg`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-400 mb-2">--</h3>
                    <p className="text-gray-700 font-semibold text-lg">{stat.title}</p>
                    <p className="text-sm text-gray-500">{stat.subtitle}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subscription Tiers Preview */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-8 border border-purple-200">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Trading Experience</h2>
              <p className="text-gray-600 text-lg">From free starter to professional collector tools</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Trainer (Free) */}
              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 bg-gray-100 rounded-xl mb-4">
                    <Shield className="h-8 w-8 text-gray-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Trainer</h3>
                  <p className="text-gray-600 mb-4">Free Tier</p>
                  <div className="text-3xl font-bold text-gray-900">Free</div>
                </div>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span>10 trade cards limit</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span>5 wanted cards limit</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span>Basic matching</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span>Daily price updates</span>
                  </li>
                </ul>
              </div>

              {/* Elite Trainer (Pro) */}
              <div className="bg-white rounded-xl p-6 shadow-xl border-2 border-blue-500 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                </div>
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 bg-blue-100 rounded-xl mb-4">
                    <Star className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Elite Trainer</h3>
                  <p className="text-gray-600 mb-4">Pro Tier</p>
                  <div className="text-3xl font-bold text-blue-600">$7.99</div>
                  <div className="text-gray-600">/month</div>
                </div>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Unlimited cards</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Advanced AI matching</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Trade analytics</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>4-6 hour price updates</span>
                  </li>
                </ul>
              </div>

              {/* Master Collector (Premium) */}
              <div className="bg-white rounded-xl p-6 shadow-lg border border-purple-200">
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 bg-purple-100 rounded-xl mb-4">
                    <Crown className="h-8 w-8 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Master Collector</h3>
                  <p className="text-gray-600 mb-4">Premium Tier</p>
                  <div className="text-3xl font-bold text-purple-600">$19.99</div>
                  <div className="text-gray-600">/month</div>
                </div>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>All Elite features</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>Bulk upload & API</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>Real-time sync</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>Trade insurance</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="text-center mt-8">
              <button
                onClick={() => setShowSubscription(true)}
                className="inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-lg hover:shadow-xl text-lg font-semibold"
              >
                <Crown className="h-6 w-6" />
                <span>View All Plans</span>
              </button>
            </div>
          </div>

          {/* How It Works Section */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
              <p className="text-gray-600 text-lg max-w-3xl mx-auto">Our AI-powered platform makes trading cards simple and efficient</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 relative">
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">1</div>
                <div className="flex flex-col items-center text-center">
                  <UserPlus className="h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Sign Up & Build Your Profile</h3>
                  <p className="text-gray-700">Create your account and set your trading preferences to get started</p>
                </div>
              </div>
              
              {/* Step 2 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 relative">
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">2</div>
                <div className="flex flex-col items-center text-center">
                  <Plus className="h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Add Your Cards</h3>
                  <p className="text-gray-700">Add cards to your trade list that you're willing to trade away</p>
                </div>
              </div>
              
              {/* Step 3 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 relative">
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">3</div>
                <div className="flex flex-col items-center text-center">
                  <Heart className="h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Set What You Want</h3>
                  <p className="text-gray-700">Create your want list with cards you're looking to acquire</p>
                </div>
              </div>
              
              {/* Step 4 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 relative">
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">4</div>
                <div className="flex flex-col items-center text-center">
                  <Zap className="h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Get Matched</h3>
                  <p className="text-gray-700">Our AI automatically finds perfect trading matches based on your cards</p>
                </div>
              </div>
              
              {/* Step 5 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 relative">
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">5</div>
                <div className="flex flex-col items-center text-center">
                  <MessageCircle className="h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Chat & Trade</h3>
                  <p className="text-gray-700">Connect with your match, discuss details, and complete your trade</p>
                </div>
              </div>
              
              {/* Step 6 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 relative">
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">6</div>
                <div className="flex flex-col items-center text-center">
                  <CreditCard className="h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Upgrade (Optional)</h3>
                  <p className="text-gray-700">Unlock premium features like advanced matching and unlimited cards</p>
                </div>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <button
                onClick={() => setShowAddCard(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Get Started Now
              </button>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="p-4 bg-blue-100 rounded-2xl inline-block mb-4">
                <Brain className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">AI-Powered Matching</h3>
              <p className="text-gray-600">Advanced algorithms analyze your collection to find perfect trading opportunities with intelligent scoring.</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="p-4 bg-gray-100 rounded-2xl inline-block mb-4">
                <Shield className="h-8 w-8 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure Trading</h3>
              <p className="text-gray-600">Built-in reputation system and secure transaction handling for worry-free trading.</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="p-4 bg-blue-100 rounded-2xl inline-block mb-4">
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Live Pricing</h3>
              <p className="text-gray-600">Real-time market pricing from Pokemon TCG API ensures fair and accurate valuations.</p>
            </div>
          </div>
        </div>

        {/* Auth Modal */}
        {showAuth && (
          <Auth
            onClose={() => setShowAuth(false)}
            onSuccess={handleAuthSuccess}
          />
        )}

        {/* Subscription Modal */}
        {showSubscription && (
          <SubscriptionModal
            isOpen={showSubscription}
            onClose={() => setShowSubscription(false)}
            currentTier="trainer"
          />
        )}
      </>
    );
  }

  // Show dashboard for logged in users (even if profile is still loading)
  return (
    <>
      {/* Show subscription processing or error or success banner at the top */}
      {subscriptionProcessing && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md">
          <div className="bg-blue-100 border border-blue-300 rounded-lg px-6 py-4 shadow-lg flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-gray-700 font-semibold">Processing your subscription...</p>
          </div>
        </div>
      )}
      {subscriptionError && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md">
          <div className="bg-red-100 border border-red-300 rounded-lg px-6 py-4 shadow-lg flex flex-col items-center">
            <Shield className="h-8 w-8 text-red-600 mb-2" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Subscription Error</h3>
            <p className="text-gray-700 mb-2">{subscriptionError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
      {subscriptionSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md">
          <div className="bg-green-100 border border-green-300 rounded-lg px-6 py-4 shadow-lg flex flex-col items-center">
            <Shield className="h-8 w-8 text-green-600 mb-2" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Subscription Activated!</h3>
            <p className="text-gray-700 mb-2">Your subscription is now active. Thank you!</p>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Continue
            </button>
          </div>
        </div>
      )}
      <div className="space-y-8">
        {/* Hero Section with Integrated Branding */}
        <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 rounded-3xl p-8 text-white overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full -translate-y-48 translate-x-48"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-600 rounded-full translate-y-32 -translate-x-32"></div>
          </div>
          
          {/* Content */}
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
              <div className="flex-1 mb-6 lg:mb-0">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
                    {profileLoading ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    ) : (
                      <img 
                        src={profile?.profile_image_url || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2'}
                        alt={profile?.username || 'User'}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold mb-2">
                      Welcome Back, {profileLoading ? 'Loading...' : (profile?.username || 'Trader')}!
                    </h1>
                    <p className="text-gray-300 text-lg">Ready to make some great trades today?</p>
                  </div>
                </div>
                
                {/* Integrated Slogan */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white mb-1">
                        Your Collection. Your Rules.
                      </div>
                      <div className="text-xl font-semibold text-blue-300">
                        Our System.
                      </div>
                      <p className="text-gray-400 text-sm mt-1">
                        The most trusted platform for trading card enthusiasts
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4 lg:ml-8">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
                  <TrendingUp className="h-6 w-6 text-blue-300 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{profile?.total_trades || 0}</div>
                  <div className="text-xs text-gray-300">Total Trades</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
                  <Brain className="h-6 w-6 text-purple-300 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{matches.length}</div>
                  <div className="text-xs text-gray-300">AI Matches</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-gray-600 text-lg max-w-3xl mx-auto">Our AI-powered platform makes trading cards simple and efficient</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">1</div>
              <div className="flex flex-col items-center text-center">
                <UserPlus className="h-12 w-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Sign Up & Build Your Profile</h3>
                <p className="text-gray-700">Create your account and set your trading preferences to get started</p>
              </div>
            </div>
            
            {/* Step 2 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">2</div>
              <div className="flex flex-col items-center text-center">
                <Plus className="h-12 w-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Add Your Cards</h3>
                <p className="text-gray-700">Add cards to your trade list that you're willing to trade away</p>
              </div>
            </div>
            
            {/* Step 3 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">3</div>
              <div className="flex flex-col items-center text-center">
                <Heart className="h-12 w-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Set What You Want</h3>
                <p className="text-gray-700">Create your want list with cards you're looking to acquire</p>
              </div>
            </div>
            
            {/* Step 4 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">4</div>
              <div className="flex flex-col items-center text-center">
                <Zap className="h-12 w-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Get Matched</h3>
                <p className="text-gray-700">Our AI automatically finds perfect trading matches based on your cards</p>
              </div>
            </div>
            
            {/* Step 5 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">5</div>
              <div className="flex flex-col items-center text-center">
                <MessageCircle className="h-12 w-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Chat & Trade</h3>
                <p className="text-gray-700">Connect with your match, discuss details, and complete your trade</p>
              </div>
            </div>
            
            {/* Step 6 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">6</div>
              <div className="flex flex-col items-center text-center">
                <CreditCard className="h-12 w-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Upgrade (Optional)</h3>
                <p className="text-gray-700">Unlock premium features like advanced matching and unlimited cards</p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <button
              onClick={() => user ? setShowAddCard(true) : setShowAuth(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Get Started Now
            </button>
          </div>
        </div>

        {/* Upgrade Banner for Free Users */}
        <div className={`bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-6 text-white ${
          profile?.subscription_status === 'active' && profile?.subscription_tier !== 'trainer' ? 'hidden' : ''
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Crown className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Unlock Premium Features</h3>
                <p className="text-purple-100">
                  Get unlimited cards, advanced AI matching, and trade analytics
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSubscription(true)}
              className="px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition-colors duration-200 font-semibold"
            >
              Upgrade Now
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                onClick={stat.onClick}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 hover:border-blue-200 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-transparent rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-4 rounded-2xl bg-gradient-to-r ${stat.color} group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</h3>
                  <p className="text-gray-700 font-semibold text-lg">{stat.title}</p>
                  <p className="text-sm text-gray-500">{stat.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={action.onClick}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 text-left border border-gray-100 hover:border-blue-200 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-gray-50 to-transparent rounded-full -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className={`p-4 rounded-2xl bg-gradient-to-r ${action.color} inline-block mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{action.title}</h3>
                  <p className="text-gray-600">{action.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Activity & Matches Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Recent Activity</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Welcome to AutoTradeTCG!</p>
                  <p className="text-sm text-gray-600">Your account is ready for trading</p>
                  <p className="text-xs text-blue-700 font-medium">Just now</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                <div className="p-3 bg-gray-600 rounded-xl shadow-lg">
                  <ArrowLeftRight className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Profile created</p>
                  <p className="text-sm text-gray-600">Start adding cards to begin trading</p>
                  <p className="text-xs text-gray-700 font-medium">1 minute ago</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-purple-100 rounded-xl">
                <Brain className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">AI Match Summary</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                <div className="w-16 h-20 bg-gradient-to-br from-purple-200 to-purple-300 rounded-lg flex items-center justify-center shadow-lg">
                  <span className="text-xs font-bold text-purple-800">{matches.length}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Potential Matches</p>
                  <p className="text-sm text-gray-600">AI-generated trading opportunities</p>
                  <p className="text-xs text-purple-700 font-medium">
                    {matches.filter(m => m.match_score >= 85).length} high-confidence matches
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                <div className="w-16 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center shadow-lg">
                  <span className="text-xs font-bold text-gray-800">{wantCards}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Want List</p>
                  <p className="text-sm text-gray-600">Cards you're seeking</p>
                  <p className="text-xs text-gray-700 font-medium">Ready for AI matching</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Card Modal */}
      {showAddCard && (
        <AddCard
          onClose={() => setShowAddCard(false)}
          onSuccess={handleAddCardSuccess}
        />
      )}

      {/* Subscription Modal */}
      {showSubscription && (
        <SubscriptionModal
          isOpen={true}
          onClose={handleSubscriptionClose}
          currentTier={profile?.subscription_tier || 'trainer'}
        />
      )}
    </>
  );
};

export default Dashboard;