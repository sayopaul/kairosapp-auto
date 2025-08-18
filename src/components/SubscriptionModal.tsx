import React, { useState } from 'react';
import { X, Check, Star, Zap, Crown, Shield, TrendingUp, Users, Bell, Upload, BarChart3, Radar, MessageCircle, Award } from 'lucide-react';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '../lib/stripe';
import StripeCheckout from './StripeCheckout';
import { useAuth } from '../hooks/useAuth';
import Auth from './Auth';
import { SubscriptionService } from '../services/subscriptionService';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: 'trainer' | 'elite' | 'master';
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ 
  isOpen, 
  onClose, 
  currentTier = 'trainer' 
}) => {
  const [selectedTier, setSelectedTier] = useState<'trainer' | 'elite' | 'master'>(currentTier);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showCheckout, setShowCheckout] = useState<'elite' | 'master' | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const { user, refetch } = useAuth(); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const tiers = {
    trainer: {
      name: 'Trainer',
      subtitle: 'Free Tier',
      price: { monthly: 0, yearly: 0 },
      color: 'from-gray-600 to-gray-700',
      icon: Shield,
      popular: false,
      features: [
        'Limited to 10 trade cards',
        'Limited to 5 wanted cards',
        'Basic matching algorithm',
        'Community forum access',
        'Daily price updates',
        'Direct user-to-user shipping only',
        'Standard support'
      ],
      limitations: [
        'No priority matching',
        'No analytics or insights',
        'No bulk upload',
        'No real-time notifications'
      ]
    },
    elite: {
      name: 'Elite Trainer',
      subtitle: 'Pro Tier',
      price: { monthly: 7.99, yearly: 79.99 },
      color: 'from-blue-600 to-blue-700',
      icon: Star,
      popular: true,
      features: [
        'Unlimited card uploads',
        'Customizable trade thresholds per card',
        'Priority access to best matches',
        'Advanced matching algorithm',
        'High-value trade notifications',
        'Trade success analytics',
        'Weekly trade insights & trends',
        'Shipping label generation',
        'Price updates every 4-6 hours',
        'Priority support'
      ],
      newFeatures: [
        'Smart trade recommendations',
        'Performance tracking dashboard',
        'Market trend alerts'
      ]
    },
    master: {
      name: 'Master Collector',
      subtitle: 'Premium Tier',
      price: { monthly: 19.99, yearly: 199.99 },
      color: 'from-purple-600 to-purple-700',
      icon: Crown,
      popular: false,
      features: [
        'All Elite Trainer features',
        'Bulk upload via spreadsheet/API',
        'Real-time TCG market sync (hourly)',
        'Trade Radar - wishlist alerts',
        'Trade hold/reserve system',
        'Direct negotiation chat with moderation',
        'Auto-suggested card bundles',
        'Auto-match queue approval',
        'Verified trade partner network',
        'High-value trade insurance',
        'White-glove support',
        'Early access to new features'
      ],
      premiumFeatures: [
        'API access for integrations',
        'Custom trade automation rules',
        'Dedicated account manager'
      ]
    }
  };

  const handleSubscribe = (tier: 'elite' | 'master') => {
    setPaymentProcessing(true);
    
    if (!user) {
      setPaymentError('Please sign in to subscribe');
      setPaymentProcessing(false);
      setShowAuth(true);
      return;
    }
    
    setShowCheckout(tier);
    setPaymentError(null);
    setPaymentProcessing(false);
  };

  const handlePaymentSuccess = async () => {
    if (!user || !showCheckout) return;
    
    setPaymentSuccess(true);
    setShowCheckout(null);
    
    // Refresh auth to get updated user profile
    if (refetch) {
      await refetch();
    }
    
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const handlePaymentError = (error: string) => {
    setPaymentError(error);
    setPaymentProcessing(false);
    setShowCheckout(null);
  };

  const getSavingsPercentage = (tier: 'elite' | 'master') => {
    const monthly = tiers[tier].price.monthly * 12;
    const yearly = tiers[tier].price.yearly;
    return Math.round(((monthly - yearly) / monthly) * 100);
  };

  // Handle auth success
  const handleAuthSuccess = () => {
    setShowAuth(false);
    if (user) setShowCheckout('elite'); // Default to elite after login
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 p-8 rounded-t-2xl text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full -translate-y-48 translate-x-48"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600 rounded-full translate-y-32 -translate-x-32"></div>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
                  <TrendingUp className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold">Choose Your Plan</h2>
                  <p className="text-gray-300 text-lg">Unlock the full potential of AutoTradeTCG</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center space-x-4">
              <span className={`text-sm ${billingCycle === 'monthly' ? 'text-white' : 'text-gray-400'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  billingCycle === 'yearly' ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                    billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm ${billingCycle === 'yearly' ? 'text-white' : 'text-gray-400'}`}>
                Yearly
              </span>
              {billingCycle === 'yearly' && (
                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                  Save up to 17%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="p-8">
          {/* Payment Success Message */}
          {paymentSuccess && (
            <div className="mb-6 flex items-center space-x-3 p-4 rounded-lg border bg-green-50 border-green-200 text-green-800">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">Subscription activated! Welcome to your new plan.</span>
            </div>
          )}

          {/* Payment Error Message */}
          {paymentError && (
            <div className="mb-6 flex items-center space-x-3 p-4 rounded-lg border bg-red-50 border-red-200 text-red-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">{paymentError}</span>
            </div>
          )}

          {/* Stripe Checkout */}
          {showCheckout && user && (
            <div className="mb-8">
              <StripeCheckout 
                tier={showCheckout}
                billingCycle={billingCycle}
                userId={user.id}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
              <div className="mt-4 text-center">
                <button 
                  onClick={() => setShowCheckout(null)}
                  className="text-gray-600 hover:text-gray-800 text-sm underline"
                >
                  Back to plans
                </button>
              </div>
            </div>
          )}

          <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 ${showCheckout || paymentProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
            {Object.entries(tiers).map(([key, tier]) => {
              const tierKey = key as keyof typeof tiers;
              const Icon = tier.icon;
              const isSelected = selectedTier === tierKey;
              const isCurrent = currentTier === tierKey;
              
              return (
                <div 
                  key={tierKey}
                  className={`relative rounded-2xl border-2 transition-all duration-300 ${
                    tier.popular 
                      ? 'border-blue-500 shadow-xl scale-105' 
                      : isSelected 
                        ? 'border-blue-300 shadow-lg' 
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2"> 
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                        Most Popular
                      </div>
                    </div>
                  )}

                  <div className="p-8">
                    {/* Header */} 
                    <div className="text-center mb-8">
                      <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-r ${tier.color} mb-4`}>
                        <Icon className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                      <p className="text-gray-600 mb-4">{tier.subtitle}</p>
                      
                      <div className="mb-4"> 
                        {tier.price.monthly === 0 ? (
                          <div className="text-4xl font-bold text-gray-900">Free</div>
                        ) : (
                          <div>
                            <div className="text-4xl font-bold text-gray-900">
                              ${billingCycle === 'monthly' ? tier.price.monthly : tier.price.yearly}
                            </div>
                            <div className="text-gray-600">
                              /{billingCycle === 'monthly' ? 'month' : 'year'}
                            </div>
                            {billingCycle === 'yearly' && tier.price.monthly > 0 && (
                              <div className="text-sm text-green-600 font-medium">
                                Save {getSavingsPercentage(tierKey as 'elite' | 'master')}%
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {isCurrent && (
                        <div className="inline-flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium"> 
                          <Check className="h-4 w-4" />
                          <span>Current Plan</span>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <div className="space-y-4 mb-8"> 
                      <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Features Included</span>
                      </h4>
                      <ul className="space-y-3">
                        {tier.features.map((feature, index) => (
                          <li key={index} className="flex items-start space-x-3">
                            <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" /> 
                            <span className="text-sm text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {tier.newFeatures && (
                        <div className="mt-6">
                          <h4 className="font-semibold text-blue-900 flex items-center space-x-2 mb-3"> 
                            <Zap className="h-4 w-4 text-blue-600" />
                            <span>New Features</span>
                          </h4>
                          <ul className="space-y-2">
                            {tier.newFeatures.map((feature, index) => (
                              <li key={index} className="flex items-start space-x-3">
                                <Star className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-blue-800 font-medium">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {tier.premiumFeatures && (
                        <div className="mt-6">
                          <h4 className="font-semibold text-purple-900 flex items-center space-x-2 mb-3"> 
                            <Crown className="h-4 w-4 text-purple-600" />
                            <span>Premium Features</span>
                          </h4>
                          <ul className="space-y-2">
                            {tier.premiumFeatures.map((feature, index) => (
                              <li key={index} className="flex items-start space-x-3">
                                <Award className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-purple-800 font-medium">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {tier.limitations && (
                        <div className="mt-6 p-4 bg-gray-50 rounded-lg"> 
                          <h4 className="font-semibold text-gray-700 text-sm mb-2">Limitations</h4>
                          <ul className="space-y-1">
                            {tier.limitations.map((limitation, index) => (
                              <li key={index} className="text-xs text-gray-600">
                                • {limitation}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="space-y-3"> 
                      {tierKey === 'trainer' ? (
                        <button
                          disabled={isCurrent}
                          className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
                            isCurrent
                              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-600 text-white hover:bg-gray-700'
                          }`}
                        >
                          {isCurrent ? 'Current Plan' : 'Current Free Plan'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSubscribe(tierKey as 'elite' | 'master')} 
                          disabled={isCurrent}
                          className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
                            isCurrent
                              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                              : tier.popular
                                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl'
                                : `bg-gradient-to-r ${tier.color} text-white hover:shadow-lg`
                          }`}
                        >
                          {isCurrent ? 'Current Plan' : `Upgrade to ${tier.name}`}
                        </button>
                      )}
                      
                      {!isCurrent && tierKey !== 'trainer' && (
                        <div className="text-center"> 
                          <p className="text-xs text-gray-500">
                            Secure payment • Cancel anytime • 30-day money-back guarantee
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feature Comparison */}
          <div className={`mt-12 bg-gray-50 rounded-2xl p-8 ${showCheckout || paymentProcessing ? 'opacity-50' : ''}`}>
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Feature Comparison</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-4 px-6 font-semibold text-gray-900">Features</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-900">Trainer</th>
                    <th className="text-center py-4 px-6 font-semibold text-blue-900">Elite Trainer</th>
                    <th className="text-center py-4 px-6 font-semibold text-purple-900">Master Collector</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-4 px-6 font-medium text-gray-900">Trade Card Limit</td>
                    <td className="py-4 px-6 text-center text-gray-600">10 cards</td>
                    <td className="py-4 px-6 text-center text-blue-600 font-semibold">Unlimited</td>
                    <td className="py-4 px-6 text-center text-purple-600 font-semibold">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium text-gray-900">Want List Limit</td>
                    <td className="py-4 px-6 text-center text-gray-600">5 cards</td>
                    <td className="py-4 px-6 text-center text-blue-600 font-semibold">Unlimited</td>
                    <td className="py-4 px-6 text-center text-purple-600 font-semibold">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium text-gray-900">Price Updates</td>
                    <td className="py-4 px-6 text-center text-gray-600">Daily</td>
                    <td className="py-4 px-6 text-center text-blue-600">4-6 hours</td>
                    <td className="py-4 px-6 text-center text-purple-600 font-semibold">Hourly</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium text-gray-900">Matching Algorithm</td>
                    <td className="py-4 px-6 text-center text-gray-600">Basic</td>
                    <td className="py-4 px-6 text-center text-blue-600 font-semibold">Advanced</td>
                    <td className="py-4 px-6 text-center text-purple-600 font-semibold">AI-Powered</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium text-gray-900">Bulk Upload</td>
                    <td className="py-4 px-6 text-center text-gray-400">✗</td>
                    <td className="py-4 px-6 text-center text-gray-400">✗</td>
                    <td className="py-4 px-6 text-center text-purple-600">✓</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium text-gray-900">Trade Analytics</td>
                    <td className="py-4 px-6 text-center text-gray-400">✗</td>
                    <td className="py-4 px-6 text-center text-blue-600">✓</td>
                    <td className="py-4 px-6 text-center text-purple-600">✓</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium text-gray-900">API Access</td>
                    <td className="py-4 px-6 text-center text-gray-400">✗</td>
                    <td className="py-4 px-6 text-center text-gray-400">✗</td>
                    <td className="py-4 px-6 text-center text-purple-600">✓</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ Section */}
          <div className={`mt-12 ${showCheckout ? 'opacity-50' : ''}`}>
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Frequently Asked Questions</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Can I change plans anytime?</h4>
                  <p className="text-gray-600 text-sm">Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">What happens to my data if I downgrade?</h4>
                  <p className="text-gray-600 text-sm">Your data is always safe. If you exceed limits after downgrading, older items become read-only until you're within limits.</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Is there a free trial for paid plans?</h4>
                  <p className="text-gray-600 text-sm">We offer a 30-day money-back guarantee on all paid plans. Try risk-free!</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">How does billing work?</h4>
                  <p className="text-gray-600 text-sm">You're billed monthly or yearly based on your choice. All payments are secure and processed through Stripe. You'll receive email receipts for all transactions.</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h4>
                  <p className="text-gray-600 text-sm">We accept all major credit cards (Visa, Mastercard, American Express), Apple Pay, Google Pay, and other payment methods supported by Stripe.</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Do you offer discounts for students?</h4>
                  <p className="text-gray-600 text-sm">Yes! Contact support with your student ID for a 50% discount on any paid plan.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className={`mt-8 bg-blue-50 rounded-lg p-4 border border-blue-200 ${showCheckout || paymentProcessing ? 'opacity-50' : ''}`}>
            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-blue-600" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Secure Payment Processing</p>
                <p>All payments are processed securely through Stripe. We never store your payment information on our servers.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Auth Modal */}
      {showAuth && (
        <Auth
          onClose={() => setShowAuth(false)} 
          onSuccess={() => {
            setShowAuth(false);
            if (user) {
              setShowCheckout('elite'); // Default to elite after login
            }
          }}
        />
      )}
    </div>
  );
};

export default SubscriptionModal;