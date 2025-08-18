import React, { useState, useEffect, useCallback } from 'react';
import { 
  X,
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  Loader2,
  MapPin,
  ArrowLeftRight,
  Clock
} from 'lucide-react';
import { ShippingRate } from '../types';
import { shippoService } from '../services/shippoService';
import { ShippingPreference } from '../types';


interface Address {
  id: string;
  first_name?: string;
  last_name?: string;
  street1: string;        
  street2?: string;      
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
  is_default: boolean;
  address_name?: string;
}


interface User {
  id: string;
  email?: string;
  displayName?: string;
}

interface ShippingPreference {
  id: string;
  address_name: string;
  first_name?: string;
  last_name?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
  is_default: boolean;
}

interface ShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradeId: string;
  user: User;
  otherUser: User;
  isProposer: boolean;
  onShippingComplete: (trackingNumber: string, carrier: string, labelUrl: string, isProposer: boolean) => void;
  onShippingError?: (error: string) => void;
  onSaveAddress?: (address: any) => Promise<any>;
  onRequestRecipientAddress?: () => Promise<void>;
  shippingPreferences?: ShippingPreference[];
  recipientShippingPreferences?: ShippingPreference[];
}

const ShippingModal= ({
  isOpen,
  onClose,
  tradeId,
  onRequestRecipientAddress,
  user,
  otherUser,
  isProposer,
  onShippingComplete,
  onShippingError = () => {},
  onSaveAddress = async () => ({} as any),
  shippingPreferences = [],
  recipientShippingPreferences = []
}: ShippingModalProps): JSX.Element | null => {
  // Early return if not open
  if (!isOpen) return null;
  // State management
  const [step, setStep] = useState<'check_recipient' | 'address' | 'rates' | 'payment' | 'confirmation'>('check_recipient');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [formData, setFormData] = useState(() => {
    // Use the default shipping preference if available
    const defaultPref = shippingPreferences?.find(p => p.is_default) || shippingPreferences?.[0];
    
    return {
      id: defaultPref?.id || '',
      name: user?.displayName || '',
      street1: defaultPref?.street1 || '',
      street2: defaultPref?.street2 || '',
      city: defaultPref?.city || '',
      state: defaultPref?.state || '',
      zip: defaultPref?.zip || '',
      country: defaultPref?.country || 'US',
      phone: defaultPref?.phone || '',
      email: user?.email || '',
      is_default: defaultPref?.is_default || false
    };
  });

  // State for selected address
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    () => shippingPreferences?.find(p => p.is_default)?.id || ''
  );

  // Handle getting shipping rates
  const handleGetRates = useCallback(async (recipientAddress: Address) => {
    if (!recipientAddress) {
      setError('Recipient address is required');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      // Get the selected address
      const selectedAddress = shippingPreferences?.find(addr => addr.id === selectedAddressId);
      if (!selectedAddress) {
        throw new Error('Please select a shipping address');
      }

      // Prepare addresses for rate calculation
      const fromAddress = {
        name: user?.displayName || 'Sender',
        street1: selectedAddress.street1,
        street2: selectedAddress.street2 || '',
        city: selectedAddress.city,
        state: selectedAddress.state,
        zip: selectedAddress.zip,
        country: selectedAddress.country || 'US',
        phone: selectedAddress.phone || '',
        email: user?.email || ''
      };

      const toAddress = {
        name: otherUser?.displayName || 'Recipient',
        street1: recipientAddress.street1,
        street2: recipientAddress.street2,
        city: recipientAddress.city,
        state: recipientAddress.state,
        zip: recipientAddress.zip,
        country: recipientAddress.country || 'US',
        phone: recipientAddress.phone || '',
        email: otherUser?.email || ''
      };

      // Get shipping rates
      const ratesResponse = await shippoService.getRates({
        address_from: fromAddress,
        address_to: toAddress,
        parcels: [
          {
            length: '10',
            width: '8',
            height: '4',
            distance_unit: 'in',
            weight: '8',
            mass_unit: 'oz',
            template: 'Cardboard Envelope',
            metadata: 'Trading Cards'
          }
        ],
        async: false,
        metadata: `Trade #${tradeId} - ${isProposer ? 'Proposer' : 'Recipient'} Shipment`
      });

      if (!ratesResponse.rates || ratesResponse.rates.length === 0) {
        throw new Error('No shipping rates available for the provided addresses.');
      }

      // Filter and sort rates
      const filteredRates = ratesResponse.rates
        .filter((rate: any) => 
          rate.servicelevel?.name && 
          ['usps_priority', 'usps_first', 'usps_ground_advantage'].includes(rate.servicelevel.token)
        )
        .sort((a: any, b: any) => a.amount - b.amount);

      setRates(filteredRates.length > 0 ? filteredRates : ratesResponse.rates);
      setStep('rates');
      
    } catch (err) {
      console.error('Error in handleGetRates:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to get shipping rates';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [shippingPreferences, selectedAddressId, isProposer, user, otherUser, tradeId]);

  // Check both addresses on mount and when recipient preferences change
  useEffect(() => {
    if (!isOpen) return;
    
    const defaultRecipientPref = recipientShippingPreferences?.find(p => p.is_default) || recipientShippingPreferences?.[0];
    const defaultUserPref = shippingPreferences?.find(p => p.is_default) || shippingPreferences?.[0];

    if (!defaultUserPref?.street1) {
      // User doesn't have an address set
      setError('Please add your shipping address first');
      setStep('address');
    } else if (!defaultRecipientPref?.street1) {
      // Recipient doesn't have an address set
      setError(`${otherUser?.displayName || 'The recipient'} needs to add their shipping address`);
      setStep('check_recipient');
    } else if (formData.street1 && formData.city && formData.state && formData.zip) {
      // Both addresses are set, proceed to rates
      setStep('rates');
      handleGetRates(defaultRecipientPref);
    } else {
      // Show address form with user's address pre-filled
      setStep('address');
    }
  }, [isOpen, recipientShippingPreferences, shippingPreferences, formData, handleGetRates, otherUser?.displayName]);

  // Handle address form submission
  const handleAddressSubmit = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Prepare the address object with first_name and last_name
      const [first_name, ...last_nameParts] = formData.name.trim().split(' ');
      const last_name = last_nameParts.join(' ') || '';

      const addressToSave: Address = {
        id: formData.id || '',
        address_name: formData.name,
        street1: formData.street1,
        street2: formData.street2,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        country: formData.country,
        phone: formData.phone,
        email: formData.email,
        is_default: formData.is_default,
        first_name,
        last_name
      };

      // Save the address
      const savedAddress = await onSaveAddress?.(addressToSave);

      // Update the selected address ID
      if (savedAddress?.id) {
        setSelectedAddressId(savedAddress.id);
      }

      // Get shipping rates
      const defaultRecipientPref = recipientShippingPreferences.find(p => p.is_default) || recipientShippingPreferences[0];
      if (defaultRecipientPref) {
        await handleGetRates(defaultRecipientPref);
      } else {
        setStep('check_recipient');
      }
    } catch (err) {
      console.error('Error saving address:', err);
      setError(err instanceof Error ? err.message : 'Failed to save address');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle refreshing recipient's address
  const handleRefreshRecipientAddress = async () => {
  try {
    setIsLoading(true);
    // Call the parent's loadRecipientPreferences to refresh the data
    const prefs = await onSaveAddress({} as any);
    const defaultPref = (prefs || []).find((p: any) => p.is_default) || (prefs || [])[0];
    
    if (defaultPref?.street1) {
      // If we got an address, proceed to rates
      await handleGetRates(defaultPref);
      setStep('rates');
    }
  } catch (error) {
    console.error('Failed to refresh address:', error);
    setError('Failed to refresh recipient address. Please try again.');
  } finally {
    setIsLoading(false);
  }
};

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle selecting a shipping rate
  const handleSelectRate = (rate: ShippingRate) => {
    setSelectedRate(rate);
    // Optionally auto-advance to payment step
    // setStep('payment');
  };

  // Handle payment submission
  const handlePayment = useCallback(async () => {
    if (!selectedRate) {
      setError('Please select a shipping rate');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Get the selected address
      const selectedAddress = shippingPreferences?.find(addr => addr.id === selectedAddressId);
      if (!selectedAddress) {
        throw new Error('Please select a shipping address');
      }

      // Prepare the sender's address
      const fromAddress = {
        name: user?.displayName || 'Sender',
        street1: selectedAddress.street1,
        street2: selectedAddress.street2 || '',
        city: selectedAddress.city,
        state: selectedAddress.state,
        zip: selectedAddress.zip,
        country: selectedAddress.country || 'US',
        phone: selectedAddress.phone || '',
        email: user?.email || ''
      };

      // Get recipient's default address
      const recipientDefaultAddress = recipientShippingPreferences?.find(addr => addr.is_default);
      if (!recipientDefaultAddress) {
        throw new Error('Recipient address not found');
      }

      // Prepare the recipient's address
      const toAddress = {
        name: otherUser?.displayName || 'Recipient',
        street1: recipientDefaultAddress.street1,
        street2: recipientDefaultAddress.street2 || '',
        city: recipientDefaultAddress.city,
        state: recipientDefaultAddress.state,
        zip: recipientDefaultAddress.zip,
        country: recipientDefaultAddress.country || 'US',
        phone: recipientDefaultAddress.phone || '',
        email: otherUser?.email || ''
      };

      // Create shipping label
      const labelResponse = await shippoService.createLabel({
        rate: selectedRate.rate_id,
        label_file_type: 'PDF',
        async: false,
        metadata: `Trade #${tradeId} - ${isProposer ? 'Proposer' : 'Recipient'}`
      });

      if (!labelResponse.label_url || !labelResponse.tracking_number || !labelResponse.rate) {
        throw new Error('Failed to create shipping label');
      }

      // Notify parent component
      onShippingComplete(
        labelResponse.tracking_number,
        labelResponse.rate.provider || 'USPS',
        labelResponse.label_url,
        isProposer
      );

      // Move to confirmation step
      setStep('confirmation');
    } catch (err) {
      console.error('Error in handlePayment:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to process payment';
      setError(errorMessage);
      
      if (onShippingError) {
        onShippingError(errorMessage);
      }
    }
    finally {
      setIsLoading(false);
    }
  }, [selectedRate, shippingPreferences, selectedAddressId, user, otherUser, isProposer, tradeId, onShippingComplete, onShippingError, recipientShippingPreferences]);

  const renderCheckRecipientStep = () => {
    const defaultRecipientPref = recipientShippingPreferences.find(p => p.is_default) || recipientShippingPreferences[0];
    
    if (defaultRecipientPref?.street1) {
      // If we somehow got here but have an address, proceed
      return (
        <div className="text-center">
          <p>Loading shipping options...</p>
        </div>
      );
    }

    return (
      <div className="text-center p-6">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
          <MapPin className="h-6 w-6 text-yellow-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Waiting on Recipient's Address</h3>
        <p className="text-sm text-gray-500 mb-6">
          {otherUser?.displayName} needs to set their shipping address before you can create a shipping label.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            disabled={isLoading}
          >
            Close
          </button>
          <button
            type="button"
            onClick={async () => {
              if (onRequestRecipientAddress) {
                setIsLoading(true);
                try {
                  await onRequestRecipientAddress();
                } catch (error) {
                  console.error('Error requesting recipient address:', error);
                } finally {
                  setIsLoading(false);
                }
              }
            }}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            disabled={isLoading || !onRequestRecipientAddress}
          >
            {isLoading ? 'Sending Request...' : 'Request Address'}
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                setIsLoading(true);
                const prefs = await onSaveAddress({} as any); // This will trigger a refresh in the parent
                const defaultPref = (prefs || []).find((p: any) => p.is_default) || (prefs || [])[0];
                if (defaultPref?.street1) {
                  // If we got an address, proceed to rates
                  handleGetRates(defaultPref);
                }
              } catch (error) {
                console.error('Failed to refresh address:', error);
              } finally {
                setIsLoading(false);
              }
            }}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 flex items-center justify-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              'Check Again'
            )}
          </button>
        </div>
      </div>
    );
  };
  
  // Define the type for the step to ensure type safety
  type StepType = 'check_recipient' | 'address' | 'rates' | 'payment' | 'confirmation';
  
  // Render the appropriate step
  const renderStep = (): JSX.Element | null => {
    // For check_recipient step
    if (step === 'check_recipient') {
      return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              {renderCheckRecipientStep()}
            </div>
          </div>
        </div>
      );
    }
    
    // For all other steps, we'll use the main modal UI
    // The actual content is conditionally rendered based on the step
    
    // Ensure all possible steps are handled
    const stepToRender: StepType = step;
    if (!['address', 'rates', 'payment', 'confirmation'].includes(stepToRender)) {
      console.error(`Unexpected step: ${step}`);
      return null;
    }
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={onClose} />
          <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-medium">Shipping Information</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                {error}
              </div>
            )}

            {step === 'address' && (
              <form onSubmit={handleAddressSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                {/* Add more form fields here */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Loading...' : 'Continue to Shipping'}
                </button>
              </form>
            )}

            {step === 'rates' && (
              <div className="space-y-4">
                <h4 className="font-medium">Select Shipping Method</h4>
                {rates.map((rate) => (
                  <div
                    key={rate.rate_id}
                    className={`p-4 border rounded cursor-pointer hover:bg-gray-50 ${
                      selectedRate?.rate_id === rate.rate_id ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => handleSelectRate(rate)}
                  >
                    <div className="flex justify-between">
                      <span>{rate.provider}</span>
                      <span>${rate.amount}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {rate.days} business days
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step === 'payment' && selectedRate && (
              <div className="space-y-4">
                <h4 className="font-medium">Payment Information</h4>
                <p>Selected: {selectedRate.provider} - ${selectedRate.amount}</p>
                {/* Add payment form here */}
                <button
                  onClick={handlePayment}
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            )}

            {step === 'confirmation' && (
              <div className="text-center space-y-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <h4 className="text-lg font-medium">Shipping Label Created!</h4>
                <p>Your shipping label has been created successfully.</p>
                <button
                  onClick={onClose}
                  className="mt-4 bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
};

export default ShippingModal;