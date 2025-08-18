import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Check, AlertCircle } from 'lucide-react';
import { useShippingPreferences } from '../hooks/useShippingPreferences';
import { ShippingPreference } from '../types';

interface ShippingAddressFormProps {
  userId?: string;
  onSubmit: (addressId: string) => void;
  loading: boolean;
  onCancel: () => void;
}

const ShippingAddressForm: React.FC<ShippingAddressFormProps> = ({
  userId,
  onSubmit,
  loading,
  onCancel,
}) => {
  const { 
    shippingPreferences: preferences, 
    addShippingPreference: addPreference, 
    updateShippingPreference: updatePreference,
    loading: preferencesLoading 
  } = useShippingPreferences(userId);
  
  // Derive defaultPreference from preferences
  const defaultPreference = preferences.find(pref => pref.is_default);

  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<ShippingPreference, 'id' | 'user_id' | 'created_at'>>({
    address_name: '',
    street1: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
    phone: '',
    is_default: preferences.length === 0, // Set as default if no preferences exist yet
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isUpdatingDefault, setIsUpdatingDefault] = useState(false);

  // Set default address when preferences load
  useEffect(() => {
    if (defaultPreference) {
      setSelectedAddressId(defaultPreference.id);
    }
  }, [defaultPreference]);

  // Handle address selection when selectedAddressId changes
  useEffect(() => {
    if (selectedAddressId) {
      console.log('Selected address changed to:', selectedAddressId);
      handleAddressSelect(selectedAddressId);
    }
  }, [selectedAddressId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    console.log("IS HERE CALLED")
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validateForm = () => {
    if (!formData.address_name.trim()) {
      setFormError('Address name is required');
      return false;
    }
    if (!formData.street1.trim()) {
      setFormError('Street address is required');
      return false;
    }
    if (!formData.city.trim()) {
      setFormError('City is required');
      return false;
    }
    if (!formData.state.trim()) {
      setFormError('State is required');
      return false;
    }
    if (!formData.zip.trim()) {
      setFormError('ZIP code is required');
      return false;
    }
    return true;
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      const newAddress = await addPreference(formData);
      setSelectedAddressId(newAddress.id);
      setShowNewAddressForm(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to add address');
    }
  };

  const handleAddressSelect = async (addressId: string) => {
    try {
      console.log("Setting the address",addressId)
      setIsUpdatingDefault(true);
      setSelectedAddressId(addressId);
      
      // Only update if it's not already the default
      const selectedAddress = preferences.find(addr => addr.id === addressId);
      if (selectedAddress && !selectedAddress.is_default) {
        await updatePreference(addressId, { is_default: true });
      }
    } catch (error) {
      console.error('Error updating default address:', error);
      setFormError('Failed to set default address');
    } finally {
      setIsUpdatingDefault(false);
    }
  };

  const handleSubmit = () => {
    if (!selectedAddressId && !showNewAddressForm) {
      setFormError('Please select an address or add a new one');
      return;
    }
    
    if (showNewAddressForm && !validateForm()) {
      return;
    }
    
    if (selectedAddressId) {
      onSubmit(selectedAddressId);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipping Information</h3>
      
      {/* Form Error */}
      {formError && (
        <div className="flex items-center space-x-3 p-4 rounded-lg border bg-red-50 border-red-200 text-red-800 mb-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{formError}</span>
        </div>
      )}
      
      {/* Saved Addresses */}
      {!showNewAddressForm && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-700">Select a shipping address</h4>
          
          {preferencesLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-24 bg-gray-200 rounded-lg"></div>
              <div className="h-24 bg-gray-200 rounded-lg"></div>
            </div>
          ) : preferences.length > 0 ? (
            <div className="space-y-3">
              {preferences.map(address => (
                <div
                  key={address.id}
                  onClick={() => {
                    if (!isUpdatingDefault) {
                      console.log('Address clicked:', address.id);
                      setSelectedAddressId(address.id);
                    }
                  }}
                  className={`p-4 border rounded-lg transition-all duration-200 ${
                    selectedAddressId === address.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  } ${isUpdatingDefault ? 'opacity-70' : 'cursor-pointer'}`}
                  aria-disabled={isUpdatingDefault}
                >
                  <div className="flex items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h5 className="font-semibold text-gray-900">{address.address_name}</h5>
                        {address.is_default && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                        {isUpdatingDefault && selectedAddressId === address.id && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                            Updating...
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm mt-1">
                        {address.street1}
                        {address.street2 && `, ${address.street2}`}
                      </p>
                      <p className="text-gray-600 text-sm">
                        {address.city}, {address.state} {address.zip}
                      </p>
                      {address.phone && (
                        <p className="text-gray-600 text-sm">
                          {address.phone}
                        </p>
                      )}
                    </div>
                    {selectedAddressId === address.id && (() => {

                      return (
                        <div className="p-1 bg-blue-500 rounded-full">
                          {console.log('Rendering checkmark for address:', address.id)}
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
              
              <button
                type="button"
                onClick={() => setShowNewAddressForm(true)}
                className="w-full flex items-center justify-center space-x-2 p-4 border border-dashed border-gray-300 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
              >
                <Plus className="h-5 w-5 text-blue-600" />
                <span className="text-blue-600 font-medium">Add New Address</span>
              </button>
            </div>
          ) : (
            <div>
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                <MapPin className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 mb-4">No saved addresses found</p>
                <button
                  type="button"
                  onClick={() => setShowNewAddressForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Add New Address
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* New Address Form */}
      {showNewAddressForm && (
        <form onSubmit={handleAddAddress} className="space-y-4">
          <h4 className="font-medium text-gray-700">Add New Address</h4>
          
          <div>
            <label htmlFor="address_name" className="block text-sm font-medium text-gray-700 mb-1">
              Address Name *
            </label>
            <input
              type="text"
              id="address_name"
              name="address_name"
              value={formData.address_name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Home, Office, etc."
              required
            />
          </div>
          
          <div>
            <label htmlFor="street1" className="block text-sm font-medium text-gray-700 mb-1">
              Street Address *
            </label>
            <input
              type="text"
              id="street1"
              name="street1"
              value={formData.street1}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="123 Main St"
              required
            />
          </div>
          
          <div>
            <label htmlFor="street2" className="block text-sm font-medium text-gray-700 mb-1">
              Apartment, Suite, etc. (optional)
            </label>
            <input
              type="text"
              id="street2"
              name="street2"
              value={formData.street2}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Apt 4B"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                City *
              </label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="New York"
                required
              />
            </div>
            
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                State *
              </label>
              <input
                type="text"
                id="state"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="NY"
                required
              />
            </div>
            
            <div>
              <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-1">
                ZIP Code *
              </label>
              <input
                type="text"
                id="zip"
                name="zip"
                value={formData.zip}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="10001"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                Country *
              </label>
              <select
                id="country"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone (optional)
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="(123) 456-7890"
              />
            </div>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_default"
              name="is_default"
              checked={formData.is_default}
              onChange={handleInputChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_default" className="ml-2 block text-sm text-gray-700">
              Set as default address
            </label>
          </div>
          
          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  <span>Save Address</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowNewAddressForm(false)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      
      {/* Action Buttons */}
      {!showNewAddressForm && (
        <div className="flex space-x-4 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || (!selectedAddressId && !showNewAddressForm)}
            className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                <span>Confirm Shipping Information</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default ShippingAddressForm;