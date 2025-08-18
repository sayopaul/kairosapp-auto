import { stripePromise, STRIPE_PRICES } from '../lib/stripe';
import { Loader2, CreditCard, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface StripeCheckoutProps {
  tier: 'elite' | 'master';
  billingCycle: 'monthly' | 'yearly';
  userId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({
  tier,
  billingCycle,
  userId,
  onSuccess,
  onError
}) => {
  const [isStripeLoaded, setIsStripeLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const getPriceId = () => {
    const key = `${tier}_${billingCycle}` as keyof typeof STRIPE_PRICES;
    return STRIPE_PRICES[key];
  };

  // Check if Stripe is loaded
  useEffect(() => {
    stripePromise.then(() => {
      setIsStripeLoaded(true);
    });
  }, []);

  const handleCheckout = async () => {
    setIsLoading(true);
    let success = false;
    const selectedTier = tier; // Store tier in local variable to prevent scope issues
    
    try {
      // Get the price ID for the selected tier and billing cycle
      const priceId = getPriceId();
      console.log('Processing checkout with price ID:', priceId, 'for user:', userId, 'tier:', tier, 'billing:', billingCycle);
      
      // Import dynamically to avoid circular dependencies
      const { redirectToCheckout } = await import('../lib/stripe'); 
      success = await redirectToCheckout(priceId, userId, selectedTier, billingCycle);
      
      if (success) {
        console.log('Checkout successful');
        onSuccess?.();
      } else {
        throw new Error('Failed to create subscription');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      onError?.(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  const prices = {
    elite: { monthly: 7.99, yearly: 79.99 },
    master: { monthly: 19.99, yearly: 199.99 }
  };

  const price = prices[tier][billingCycle];
  const savings = billingCycle === 'yearly' ? Math.round(((prices[tier].monthly * 12 - prices[tier].yearly) / (prices[tier].monthly * 12)) * 100) : 0;

  // Show loading state if Stripe is not loaded yet
  if (!isStripeLoaded) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
        <p className="text-gray-600">Loading payment system...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <CreditCard className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {tier === 'elite' ? 'Elite Trainer' : 'Master Collector'}
          </h3>
          <p className="text-gray-600">
            ${price.toFixed(2)}/{billingCycle === 'monthly' ? 'month' : 'year'}
            {savings > 0 && (
              <span className="ml-2 text-green-600 font-medium">Save {savings}%</span>
            )}
          </p>
        </div>
      </div>
      <div className="space-y-3 mb-6">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>Secure payment processing</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Shield className="h-4 w-4 text-green-500" />
          <span>Cancel anytime</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>30-day money-back guarantee</span>
        </div>
      </div>

      <button
        onClick={handleCheckout}
        disabled={isLoading}
        className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Processing Subscription...</span>
          </>
        ) : (
          <>
            <CreditCard className="h-5 w-5" />
            <span>Subscribe</span>
          </>
        )}
      </button>

      <p className="text-xs text-gray-500 text-center mt-3">
        Secure payment processing
      </p>
    </div>
  );
};

export default StripeCheckout;