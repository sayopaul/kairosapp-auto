import React, { useState } from 'react';
import { Plus, X, Save, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCards } from '../hooks/useCards';
import { useCardVariants } from '../hooks/useCardVariants';
import { Card } from '../types';

interface AddCardFormProps {
  onClose?: () => void;
  onSuccess?: () => void;
  defaultListType?: 'trade' | 'want';
}

const AddCardForm: React.FC<AddCardFormProps> = ({ 
  onClose, 
  onSuccess, 
  defaultListType = 'trade' 
}) => {
  const { user } = useAuth();
  const { addCard, error: cardsError } = useCards(user?.id);
  const { variants, loading: variantsLoading, error: variantsError } = useCardVariants();
  
  const [formData, setFormData] = useState({
    name: '',
    set: '',
    card_number: '',
    condition: 'Near Mint' as Card['condition'],
    quantity: 1,
    list_type: defaultListType,
    market_price: '',
    image_url: '',
    variant_type: '' // New field for card variant
  });
  
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; text: string } | null>(null);

  const conditionOptions: Card['condition'][] = [
    'Mint',
    'Near Mint', 
    'Lightly Played',
    'Moderately Played',
    'Heavily Played',
    'Damaged'
  ];

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

  const handleVariantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedVariant(value);
    setFormData(prev => ({
      ...prev,
      variant_type: value
    }));
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

    setIsSubmitting(true);
    setMessage(null);

    try {
      console.log('Submitting card data with variant...');
      
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

      // Now save to user_cards table with the selected variant
      if (result && selectedVariant) {
        const { error: userCardError } = await supabase
          .from('user_cards')
          .insert([{
            user_id: user.id,
            variant_id: selectedVariant, // This should reference the card_variants.id
            quantity: formData.quantity,
            condition: formData.condition,
            for_trade: formData.list_type === 'trade',
            want: formData.list_type === 'want'
          }]);

        if (userCardError) {
          console.error('Error saving to user_cards:', userCardError);
          setMessage({ 
            type: 'warning', 
            text: 'Card added but variant selection failed. You can update this later.' 
          });
        } else {
          console.log('Card variant saved to user_cards successfully');
        }
      }
      
      setMessage({ 
        type: 'success', 
        text: 'Card added successfully!' 
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
        image_url: '',
        variant_type: ''
      });
      setSelectedVariant('');

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
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          {/* Variants Error Display */}
          {variantsError && (
            <div className="flex items-center space-x-3 p-4 rounded-lg border bg-red-50 border-red-200 text-red-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">Error loading variants: {variantsError}</span>
            </div>
          )}

          {/* Card Name */}
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
          </div>

          {/* Card Variant Dropdown */}
          <div>
            <label htmlFor="variant_type" className="block text-sm font-semibold text-gray-700 mb-2">
              Card Variant
            </label>
            {variantsLoading ? (
              <div className="flex items-center space-x-2 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-gray-600">Loading variants...</span>
              </div>
            ) : (
              <select
                id="variant_type"
                name="variant_type"
                value={selectedVariant}
                onChange={handleVariantChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">Select a variant (optional)</option>
                {variants.map(variant => (
                  <option key={variant.id} value={variant.id}>
                    {variant.description || variant.variant_type}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Choose a specific variant if applicable (e.g., Holo, Reverse Holo, etc.)
            </p>
          </div>

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
                Market Price
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
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label htmlFor="image_url" className="block text-sm font-semibold text-gray-700 mb-2">
              Image URL
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
              Leave empty to use default card image
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || variantsLoading}
              className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
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

export default AddCardForm;