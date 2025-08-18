import React, { useState } from 'react';
import { Plus, X, Save, AlertCircle, CheckCircle, Zap, Crown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCards } from '../hooks/useCards';
import { useSubscriptionLimits } from '../hooks/useSubscriptionLimits';
import { Card } from '../types';
import CardSearch from './CardSearch';
import { TransformedCard } from '../services/pokemonTcgApi';


interface AddCardProps {
  onClose?: () => void;
  onSuccess?: () => void;
  defaultListType?: 'trade' | 'want';
}

const AddCard: React.FC<AddCardProps> = ({ onClose, onSuccess, defaultListType = 'trade' }) => {
  const { user } = useAuth();
  const { addCard, error: cardsError } = useCards(user?.id);
  const { cards: allCards } = useCards(user?.id);
  const { checkLimit, currentTier } = useSubscriptionLimits(user?.id);
  
  const [formData, setFormData] = useState({
    name: '',
    set: '',
    card_number: '',
    condition: 'Near Mint' as Card['condition'],
    quantity: 1,
    list_type: defaultListType,
    market_price: '',
    image_url: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; text: string } | null>(null);
  const [useApiSearch, setUseApiSearch] = useState(true);

  const conditionOptions: Card['condition'][] = [
    'Mint',
    'Near Mint', 
    'Lightly Played',
    'Moderately Played',
    'Heavily Played',
    'Damaged'
  ];

  // Check current card counts
  const tradeCards = allCards.filter(card => card.list_type === 'trade');
  const wantCards = allCards.filter(card => card.list_type === 'want');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' ? parseInt(value) || 1 : value
    }));
    
    // Clear any previous messages when user starts typing
    if (message) {
      setMessage(null);
    }
  };

  const handleCardSelect = (card: TransformedCard) => {
    try {
      console.log('🎯 AddCard: Card selected:', card.name, 'Price:', card.market_price);
      
      setFormData(prev => ({
        ...prev,
        name: card.name,
        set: card.set,
        card_number: card.card_number,
        image_url: card.image_url,
        market_price: card.market_price.toString()
      }));

      // Try to get updated pricing from JustTCG API
      // Disable this for now
      // JustTcgApiService.searchCardPricing(card.name, card.set).then(pricing => {
      //   if (pricing) {
      //     const bestPrice = JustTcgApiService.getBestPrice(pricing);
      //     if (bestPrice && bestPrice > 0) {
      //       setFormData(prev => ({
      //         ...prev,
      //         market_price: bestPrice.toString()
      //       }));
      //       setMessage({
      //         type: 'success',
      //         text: `✅ Card details loaded! Updated price from JustTCG: $${bestPrice.toFixed(2)}`
      //       });
      //     } else {
      //       setMessage({
      //         type: 'success',
      //         text: `✅ Card details loaded! Market price: $${card.market_price.toFixed(2)} (Pokémon TCG API)`
      //       });
      //     }
      //   } else {
      //     setMessage({
      //       type: 'success',
      //       text: `✅ Card details loaded! Market price: $${card.market_price.toFixed(2)} (Pokémon TCG API)`
      //     });
      //   }
      // }).catch(() => {
      //   setMessage({
      //     type: 'success',
      //     text: `✅ Card details loaded! Market price: $${card.market_price.toFixed(2)} (Pokémon Price Tracker API)`
      //   });
      // });


       
      
      console.log('✅ AddCard: Form data updated successfully');
    } catch (error) {
      console.error('Error selecting card:', error);
      setMessage({
        type: 'error',
        text: '❌ Failed to load card details. Please try again.'
      });
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Card name is required' });
      return false;
    }

    if (formData.quantity < 1) {
      setMessage({ type: 'error', text: 'Quantity must be at least 1' });
      return false;
    }

    if (formData.market_price && parseFloat(formData.market_price) < 0) {
      setMessage({ type: 'error', text: 'Market price cannot be negative' });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setMessage({ type: 'error', text: 'You must be logged in to add cards' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    // Check subscription limits
    const currentCount = formData.list_type === 'trade' ? tradeCards.length : wantCards.length;
    const limitCheck = checkLimit(formData.list_type, currentCount);
    
    if (!limitCheck.allowed) {
      setMessage({ 
        type: 'warning', 
        text: limitCheck.message || 'Card limit reached for your subscription tier' 
      });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      console.log('Submitting card data...');
      
      const cardData = {
        user_id: user.id,
        name: formData.name.trim(),
        set: formData.set.trim() || 'Unknown Set',
        card_number: formData.card_number.trim() || '',
        condition: formData.condition,
        quantity: formData.quantity,
        list_type: formData.list_type,
        market_price: formData.market_price ? parseFloat(formData.market_price) : 0,
        image_url: formData.image_url.trim() || 'https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2'
      };

      console.log('Card data to submit:', cardData);

      const result = await addCard(cardData);
      console.log('Card added successfully:', result);
      
      setMessage({ 
        type: 'success', 
        text: 'Card added successfully! The auto-matching system will check for potential trades.' 
      });
      
      // Reset form
      setFormData({
        name: '',
        set: '',
        card_number: '',
        condition: 'Near Mint',
        quantity: 1,
        list_type: defaultListType,
        market_price: '',
        image_url: ''
      });

      // Call success callback after a short delay
      setTimeout(() => {
        onSuccess?.();
      }, 2000);

    } catch (error) {
      console.error('Error adding card:', error);
      
      let errorMessage = 'Failed to add card. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (cardsError) {
        errorMessage = cardsError;
      }
      
      setMessage({ 
        type: 'error', 
        text: errorMessage
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Plus className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Add New Card</h2>
                <p className="text-blue-100">
                  Add a card to your {formData.list_type === 'trade' ? 'trade list' : 'want list'}
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Auto-matching Feature Notice */}
          <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
            <div className="flex items-center space-x-3">
              <Zap className="h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">Auto-Matching Enabled</h3>
                <p className="text-sm text-green-700">System will automatically find matches when you add this card</p>
              </div>
            </div>
          </div>

          {/* Subscription Limit Warning */}
          {(() => {
            const currentCount = formData.list_type === 'trade' ? tradeCards.length : wantCards.length;
            const limitCheck = checkLimit(formData.list_type, currentCount);
            
            if (!limitCheck.allowed) {
              return (
                <div className="flex items-start space-x-3 p-4 rounded-lg border bg-orange-50 border-orange-200">
                  <Crown className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-orange-900">Subscription Limit Reached</h4>
                    <p className="text-sm text-orange-800 mt-1">{limitCheck.message}</p>
                    <p className="text-xs text-orange-700 mt-2">
                      Current tier: <strong>{currentTier === 'trainer' ? 'Free' : currentTier === 'elite' ? 'Elite Trainer' : 'Master Collector'}</strong>
                    </p>
                  </div>
                </div>
              );
            }
            
            // Show approaching limit warning
            const maxCards = formData.list_type === 'trade' ? 
              (currentTier === 'trainer' ? 10 : Infinity) : 
              (currentTier === 'trainer' ? 5 : Infinity);
            
            if (maxCards !== Infinity && currentCount >= maxCards * 0.8) {
              return (
                <div className="flex items-start space-x-3 p-4 rounded-lg border bg-yellow-50 border-yellow-200">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Approaching Limit</h4>
                    <p className="text-sm text-yellow-800 mt-1">
                      You have {currentCount} of {maxCards} {formData.list_type} cards. Consider upgrading for unlimited cards.
                    </p>
                  </div>
                </div>
              );
            }
            
            return null;
          })()}

          {/* Message Display */}
          {message && (
            <div className={`flex items-center space-x-3 p-4 rounded-lg border ${
              message.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : message.type === 'warning'
                ? 'bg-orange-50 border-orange-200 text-orange-800'
                : message.type === 'info'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
              ) : message.type === 'info' ? (
                <Zap className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          {/* Search Mode Toggle */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Zap className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-blue-900">Smart Card Search</h3>
                  <p className="text-sm text-blue-700">Auto-populate card details and pricing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUseApiSearch(!useApiSearch)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  useApiSearch ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                    useApiSearch ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Card Search or Manual Input */}
          {useApiSearch ? (
            <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Search Pokemon Cards *
            </label>
            <div className="flex items-center text-xs text-gray-500 mt-1 space-x-2">
              <span>Search format:</span>
              <div className="flex items-center space-x-1">
                <span className="px-2 py-0.5 bg-gray-100 rounded">Card Name</span>
                <span className="px-1 font-bold text-gray-700">,</span>
                <span className="px-2 py-0.5 bg-gray-100 rounded">Set Name</span>
                <span className="px-1 font-bold text-gray-700">,</span>
                <span className="px-2 py-0.5 bg-gray-100 rounded">Condition</span>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-3 mb-3">
              Tip: Start typing for suggestions. Include set name for more accurate results.
            </p>

            <CardSearch 
              onCardSelect={handleCardSelect} 
              maxResults={50}
              placeholder="e.g., Charizard, Base Set, Near Mint (comma separated)"
            />
            
           
          </div>
          ) : (
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                Card Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter card name (e.g., Charizard, Pikachu)"
              />
              <p className="text-xs text-blue-600 mt-1">
                💡 Tip: Use exact Pokemon names for better auto-matching (Charizard, Pikachu, Blastoise)
              </p>
            </div>
          )}

          {/* Set and Card Number Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="set" className="block text-sm font-semibold text-gray-700 mb-2">
                Set
              </label>
              <input
                type="text"
                id="set"
                name="set"
                value={formData.set}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="e.g., Base Set"
              />
            </div>
            <div>
              <label htmlFor="card_number" className="block text-sm font-semibold text-gray-700 mb-2">
                Card Number
              </label>
              <input
                type="text"
                id="card_number"
                name="card_number"
                value={formData.card_number}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="e.g., 006"
              />
            </div>
          </div>

          {/* Condition and List Type Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="condition" className="block text-sm font-semibold text-gray-700 mb-2">
                Condition
              </label>
              <select
                id="condition"
                name="condition"
                value={formData.condition}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                {conditionOptions.map(condition => (
                  <option key={condition} value={condition}>
                    {condition}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="list_type" className="block text-sm font-semibold text-gray-700 mb-2">
                List Type *
              </label>
              <select
                id="list_type"
                name="list_type"
                value={formData.list_type}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="trade">For Trade (I have this card)</option>
                <option value="want">Want List (I want this card)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Choose "trade" for cards you own, "want" for cards you're seeking
              </p>
            </div>
          </div>

          {/* Quantity and Market Price Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantity" className="block text-sm font-semibold text-gray-700 mb-2">
                Quantity
              </label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                min="1"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            <div>
              <label htmlFor="market_price" className="block text-sm font-semibold text-gray-700 mb-2">
                Market Price {useApiSearch && '(Auto-populated)'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  id="market_price"
                  name="market_price"
                  value={formData.market_price}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="0.00"
                />
              </div>
              {useApiSearch && (
                <p className="text-xs text-blue-600 mt-1">
                  Price automatically updated from PokemonPriceTracker)
                </p>
              )}
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label htmlFor="image_url" className="block text-sm font-semibold text-gray-700 mb-2">
              Image URL {useApiSearch && '(Auto-populated)'}
            </label>
            <input
              type="url"
              id="image_url"
              name="image_url"
              value={formData.image_url}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="https://example.com/card-image.jpg"
            />
            <p className="text-xs text-gray-500 mt-1">
              {useApiSearch 
                ? 'High-quality image automatically loaded from Pokémon TCG API'
                : 'Leave empty to use default card image'
              }
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || (() => {
                const currentCount = formData.list_type === 'trade' ? tradeCards.length : wantCards.length;
                const limitCheck = checkLimit(formData.list_type, currentCount);
                return !limitCheck.allowed;
              })()}
              className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Adding Card...</span>
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  <span className="font-medium">Add Card</span>
                </>
              )}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCard;