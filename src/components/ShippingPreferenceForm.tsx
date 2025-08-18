import React, { useState } from 'react';
import { MapPin, Save, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useShippingPreferences, ShippingPreference } from '../hooks/useShippingPreferences';

interface ShippingPreferenceFormProps {
  initialData?: Partial<ShippingPreference>;
  onSave?: () => void;
  onCancel?: () => void;
}

const ShippingPreferenceForm: React.FC<ShippingPreferenceFormProps> = ({
  initialData,
  onSave,
  onCancel
}) => {
  const { user } = useAuth();
  const { addShippingPreference, updateShippingPreference, loading } = useShippingPreferences(user?.id);
  
  const [formData, setFormData] = useState<Partial<ShippingPreference>>({
    address_name: initialData?.address_name || '',
    street1: initialData?.street1 || '',
    street2: initialData?.street2 || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    zip: initialData?.zip || '',
    country: initialData?.country || 'US',
    phone: initialData?.phone || '',
    is_default: initialData?.is_default !== undefined ? initialData.is_default : true
  });
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const validateForm = () => {
    if (!formData.address_name?.trim()) {
      setError('Address name is required');
      return false;
    }
    
    if (!formData.street1?.trim()) {
      setError('Street address is required');
      return false;
    }
    
    if (!formData.city?.trim()) {
      setError('City is required');
      return false;
    }
    
    if (!formData.state?.trim()) {
      setError('State is required');
      return false;
    }
    
    if (!formData.zip?.trim()) {
      setError('ZIP code is required');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to save shipping preferences');
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    try {
      if (initialData?.id) {
        // Update existing preference
        await updateShippingPreference(initialData.id, formData);
      } else {
        // Add new preference
        await addShippingPreference(formData as Omit<ShippingPreference, 'id' | 'user_id' | 'created_at'>);
      }
      
      setSuccess('Shipping address saved successfully!');
      
      setTimeout(() => {
        if (onSave) onSave();
      }, 1500);
    } catch (err) {
      console.error('Error saving shipping preference:', err);
      setError(err instanceof Error ? err.message : 'Failed to save shipping preference');
    }
  };
  
  const usStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-xl">
          <MapPin className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {initialData?.id ? 'Edit Shipping Address' : 'Add Shipping Address'}
          </h3>
          <p className="text-gray-600">
            {initialData?.id 
              ? 'Update your shipping information'
              : 'Add a new shipping address for trading cards'
            }
          </p>
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-3 p-4 rounded-lg border bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}
      
      {/* Success Message */}
      {success && (
        <div className="flex items-center space-x-3 p-4 rounded-lg border bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{success}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="address_name" className="block text-sm font-semibold text-gray-700 mb-2">
            Address Name *
          </label>
          <input
            type="text"
            id="address_name"
            name="address_name"
            value={formData.address_name}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            placeholder="Home, Office, etc."
            required
          />
        </div>
        
        <div>
          <label htmlFor="street1" className="block text-sm font-semibold text-gray-700 mb-2">
            Street Address *
          </label>
          <input
            type="text"
            id="street1"
            name="street1"
            value={formData.street1}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            placeholder="123 Main St"
            required
          />
        </div>
        
        <div>
          <label htmlFor="street2" className="block text-sm font-semibold text-gray-700 mb-2">
            Apartment, Suite, etc. (Optional)
          </label>
          <input
            type="text"
            id="street2"
            name="street2"
            value={formData.street2}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            placeholder="Apt 4B"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="city" className="block text-sm font-semibold text-gray-700 mb-2">
              City *
            </label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="New York"
              required
            />
          </div>
          
          <div>
            <label htmlFor="state" className="block text-sm font-semibold text-gray-700 mb-2">
              State *
            </label>
            <select
              id="state"
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              required
            >
              <option value="">Select State</option>
              {usStates.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="zip" className="block text-sm font-semibold text-gray-700 mb-2">
              ZIP Code *
            </label>
            <input
              type="text"
              id="zip"
              name="zip"
              value={formData.zip}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="10001"
              required
            />
          </div>
          
          <div>
            <label htmlFor="country" className="block text-sm font-semibold text-gray-700 mb-2">
              Country *
            </label>
            <select
              id="country"
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              required
            >
              <option value="US">United States</option>
              <option value="CA">Canada</option>
            </select>
          </div>
        </div>
        
        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            placeholder="(555) 555-5555"
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_default"
            name="is_default"
            checked={formData.is_default}
            onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="is_default" className="ml-2 block text-sm text-gray-900">
            Set as default shipping address
          </label>
        </div>
        
        <div className="flex space-x-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                <span className="font-medium">Save Address</span>
              </>
            )}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ShippingPreferenceForm;