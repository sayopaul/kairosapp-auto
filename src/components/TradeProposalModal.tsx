import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { JSX } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTradeProposals, useTradeProposalForMatch } from '../hooks/useTradeProposals';
import { useShippingPreferences } from '../hooks/useShippingPreferences';
import { Card, ShippingPreference, TradeProposal } from '../types';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { AlertCircle,Truck, ArrowLeftRight,MessageCircle, Check, CheckCircle, Clock, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Import components
import ShippingPreferenceForm from './ShippingPreferenceForm';
import ShippingMethodSelector from './ShippingMethodSelector';
import ShippingModal from './ShippingModal';

// Types
type ModalStep = 
  | 'propose' 
  | 'accept' 
  | 'confirm' 
  | 'shipping' 
  | 'create_label' 
  | 'waiting_for_label' 
  | 'complete';

interface Message {
  type: 'success' | 'error' | 'info';
  text: string;
}

interface TradeProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  matchScore: number;
  user1: {
    id: string;
    username: string;
    profile_image_url?: string;
    email?: string;
  };
  user2: {
    id: string;
    username: string;
    profile_image_url?: string;
    email?: string;
  };
  user1Card?: Card;
  user2Card?: Card;
  isBundle?: boolean;
  user1Cards?: Card[];
  user2Cards?: Card[];
}

const TradeProposalModal = ({
  isOpen,
  onClose,
  matchId,
  matchScore,
  user1,
  user2,
  user1Card,
  user2Card,
  isBundle = false,
  user1Cards = [],
  user2Cards = []
}: TradeProposalModalProps): JSX.Element | null => {
  // State management
  const [step, setStep] = useState<ModalStep>('propose');
  const [shippingMethod, setShippingMethod] = useState<'mail' | 'local_meetup'>('mail');
  // const [isUpdatingDefault, setIsUpdatingDefault] = useState(false);
  // const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [existingProposal, setExistingProposal] = useState<TradeProposal | null>(null);
  const [isShippingModalOpen, setShippingModalOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [labelUrl, setLabelUrl] = useState('');
  // State for recipient's shipping preferences
  const [recipientPrefs, setRecipientPrefs] = useState<ShippingPreference[]>([]);

  // Auth and data hooks
  const { user } = useAuth();
  
  // Memoize derived values
  const otherUserId = useMemo(() => 
    user?.id === user1.id ? user2.id : user1.id,
    [user?.id, user1.id, user2.id]
  );

  const otherUser = useMemo(() => 
    user?.id === user1.id ? user2 : user1,
    [user?.id, user1, user2]
  );

  

  // Determine if current user is proposer or recipient
  const isProposer = useMemo(() => 
    existingProposal ? existingProposal.proposer_id === user?.id : user?.id === user1.id,
    [existingProposal, user?.id, user1.id]
  );

  // Enhanced debug logging for step changes
  useEffect(() => {
    console.log('%c🔍 TradeProposalModal STEP CHANGE', 'color: #4CAF50; font-weight: bold;', {
      step,
      timestamp: new Date().toISOString(),
      component: 'TradeProposalModal'
    });
  }, [step]);

  // Enhanced debug logging for header state
  useEffect(() => {
    console.log('%c📝 TradeProposalModal STATE', 'color: #2196F3; font-weight: bold;', {
      step,
      isProposer,
      currentUserId: user?.id,
      proposal: existingProposal ? {
        id: existingProposal.id,
        status: existingProposal.status,
        proposer_id: existingProposal.proposer_id,
        recipient_id: existingProposal.recipient_id,
        shipping_method: existingProposal.shipping_method
      } : null,
      otherUserId,
      timestamp: new Date().toISOString()
    });
  }, [step, existingProposal, isProposer, user?.id, otherUserId]);
  
  // Memoized handlers and derived state
  // const handleClose = useCallback(() => {
  //   onClose();
  //   setStep('propose');
  //   setMessage(null);
  // }, [onClose]);
  
  const handleMessage = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
  }, []);

  const { 
    createProposal, 
    updateProposal,
    deleteProposal,
    updateTradeStatus,
    completeTradeProposal,
    loading: proposalsLoading 
  } = useTradeProposals(user?.id);
  
  // Fetch the proposal using matchId
  const { 
    proposal: fetchedProposal, 
    loading: proposalLoading,
    updateProposal: updateFetchedProposal,
    refetch: refetchProposal
  } = useTradeProposalForMatch(matchId, user?.id);
  
// Current user's shipping preferences
const { 
  shippingPreferences = [], 
  fetchShippingPreferences,
  addShippingPreference,
  updateShippingPreference,
  loading: shippingPreferencesLoading
} = useShippingPreferences(user?.id || '');

const [isUpdatingDefault, setIsUpdatingDefault] = useState(false);
const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

const handleAddressClick = useCallback(async (addressId: string) => {
  if (isUpdatingDefault) return;
  
  try {
    setIsUpdatingDefault(true);
    setSelectedAddressId(addressId);
    await updateShippingPreference(addressId, { is_default: true });
    await fetchShippingPreferences(); // Refresh the list
  } catch (error) {
    console.error('Error updating default address:', error);
    handleMessage('error', 'Failed to update default address');
  } finally {
    setIsUpdatingDefault(false);
  }
}, [isUpdatingDefault, updateShippingPreference, fetchShippingPreferences, handleMessage]);
  
  // Initialize recipient's shipping preferences
  const { 
    fetchShippingPreferences: fetchRecipientPreferences,
    loading: loadingRecipientPrefs 
  } = useShippingPreferences('');
  
  // Fetch recipient's preferences when otherUserId is available
  useEffect(() => {
    if (otherUserId) {
      console.log('Fetching shipping preferences for recipient:', otherUserId);
      fetchRecipientPreferences(otherUserId).catch(error => {
        console.error('Error fetching recipient shipping preferences:', error);
        handleMessage('error', 'Failed to load recipient shipping preferences');
      });
    }
  }, [otherUserId, fetchRecipientPreferences, handleMessage]);
  
  // Update existingProposal when fetchedProposal changes
  useEffect(() => {
    if (fetchedProposal) {
      setExistingProposal(fetchedProposal);
    }
  }, [fetchedProposal]);

  // Memoize the refetch function to prevent unnecessary re-renders
  const memoizedRefetchProposal = useCallback(async () => {
    if (refetchProposal) {
      const updatedProposal = await refetchProposal();
      if (updatedProposal) {
        setExistingProposal(updatedProposal);
      }
      return updatedProposal;
    }
  }, [refetchProposal]);

  useEffect(() => {
    if (otherUserId) {
      console.log("Other user ID set to:", otherUserId);
    }
  }, [otherUserId]);
  
  // Combine update functions to ensure both are called
  const handleUpdateProposal = useCallback(async (id: string, updates: Partial<TradeProposal>) => {
    const result = await updateProposal(id, updates);
    await updateFetchedProposal(id, updates);
    return result;
  }, [updateProposal, updateFetchedProposal]);
  
  const isRecipient = existingProposal ? existingProposal.recipient_id === user?.id : user?.id === user2.id;

  // Fetch shipping preferences when component mounts
  useEffect(() => {
    if (user?.id) {
      // Fetch current user's shipping preferences
      fetchShippingPreferences();
      
      // Fetch recipient's shipping preferences
      const loadRecipientPrefs = async () => {
        try {
          const prefs = await fetchRecipientPreferences();
          if (prefs) setRecipientPrefs(prefs);
        } catch (error) {
          console.error('Error loading recipient preferences:', error);
        }
      };
      
      loadRecipientPrefs();
    }
  }, [user?.id, fetchShippingPreferences, fetchRecipientPreferences]);

  // Determine user roles and other user data
  const loading = isProcessing || proposalsLoading || shippingPreferencesLoading || proposalLoading;
  
  // Update step based on proposal status
  useEffect(() => {
    if (!existingProposal || !isOpen) return;
    
    console.log("Updating step based on proposal status:", existingProposal.status);
    
    if (existingProposal.status === 'proposed') {
      setStep(isRecipient ? 'accept' : 'propose');
    } else if (existingProposal.status === 'accepted_by_recipient') {
      setStep(isProposer ? 'confirm' : 'accept');
    } else if (existingProposal.status === 'shipping_pending' || existingProposal.status === 'shipping_confirmed') {
      setStep('shipping');
      const method = existingProposal.shipping_method as 'mail' | 'local_meetup' | undefined;
      setShippingMethod(method || 'mail');
    } else if (existingProposal.status === 'completed') {
      setStep('complete');
    }
  }, [existingProposal, isRecipient, isProposer, isOpen]);
  
  // Fetch shipping preferences on mount
  useEffect(() => {
    if (user?.id) {
      fetchShippingPreferences();
    }
  }, [user?.id, fetchShippingPreferences]);

  // Handle shipping confirmation is defined later in the file

  // Handle saving a new shipping address
  const handleSaveAddress = useCallback(async (address: Omit<ShippingPreference, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return false;
    
    try {
      setIsProcessing(true);
      const newAddress = await addShippingPreference({
        ...address,
        is_default: shippingPreferences.length === 0 // Set as default if this is the first address
      });
      
      // Refresh the shipping preferences
      await fetchShippingPreferences();
      
      return newAddress;
    } catch (error) {
      console.error('Error saving address:', error);
      handleMessage('error', 'Failed to save shipping address. Please try again.');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [addShippingPreference, fetchShippingPreferences, shippingPreferences.length, user, handleMessage]);

  const handleRequestRecipientAddress = useCallback(async () => {
    try {
      // Implementation of handleRequestRecipientAddress
      // ...
    } catch (error) {
      console.error('Error requesting recipient address:', error);
      setMessage({
        type: 'error',
        text: 'Failed to request recipient address. Please try again.'
      });
    }
  }, [existingProposal?.id, user?.id]);

  const handleShippingComplete = useCallback(() => {
    setMessage({
      type: 'success',
      text: 'Shipping label created successfully!'
    });
    // Close the shipping modal
    setShippingModalOpen(false);
    // You might want to refresh the trade proposal data here
    // or update the UI to reflect the new shipping status
  }, []);

  // Validate trade proposal data
  const isValidData = useCallback((): boolean => {
    if (isBundle) {
      return (user1Cards?.length ?? 0) > 0 && (user2Cards?.length ?? 0) > 0;
    }
    return !!user1Card && !!user2Card;
  }, [isBundle, user1Card, user2Card, user1Cards, user2Cards]);

  // Handle proposing a new trade
  const handlePropose = useCallback(async () => {
    if (!user || !isValidData()) {
      setMessage({
        type: 'error',
        text: 'Cannot create proposal with invalid data'
      });
      return;
    }

    // Get the default shipping address for the current user
    const defaultAddress = shippingPreferences.find(addr => addr.is_default) || shippingPreferences[0];
    if (!defaultAddress) {
      setMessage({
        type: 'error',
        text: 'Please add a shipping address before proposing a trade'
      });
      return;
    }
    
    // Check if proposal already exists
    if (existingProposal) {
      setMessage({
        type: 'error',
        text: 'A trade proposal already exists for this match'
      });
      return;
    }
    
    try {
      setIsProcessing(true);
      setMessage(null);
      
      const proposal = await createProposal({
        match_id: matchId,
        proposer_id: user.id,
        recipient_id: otherUser.id,
        shipping_method: shippingMethod,
        status: 'proposed' as const,
        proposer_address_id: defaultAddress.id
      });
      
      setMessage({
        type: 'success',
        text: `Trade proposal sent to ${otherUser.username}!`
      });
      
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error proposing trade:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to propose trade'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    user?.id, 
    matchId, 
    isProposer, 
    user1Card?.id, 
    user2Card?.id, 
    isBundle, 
    user1Cards, 
    user2Cards, 
    matchScore, 
    otherUser.id, 
    createProposal,
    setMessage,
    setIsProcessing,
  ]);

  // Effect to handle shipping info updates
  useEffect(() => {
    if (!existingProposal) return;
    
    const updateShippingInfo = async () => {
      // Initialize updateData object to store shipping updates
      const updateData: any = {};

      // Update the appropriate fields based on who is shipping
      if (isProposer) {
        updateData.proposer_tracking_number = trackingNumber;
        updateData.proposer_carrier = carrier;
        updateData.proposer_label_url = labelUrl;
        updateData.proposer_shipping_confirmed = true;
      } else {
        updateData.recipient_tracking_number = trackingNumber;
        updateData.recipient_carrier = carrier;
        updateData.recipient_label_url = labelUrl;
        updateData.recipient_shipping_confirmed = true;
      }

      // Keep the old fields for backward compatibility
      updateData.tracking_number = trackingNumber;
      updateData.carrier = carrier;
      updateData.label_url = labelUrl;

      if (!existingProposal) {
        console.error('No existing proposal found');
        handleMessage('error', 'No trade proposal found to update');
        return;
      }

      const { error } = await supabase
        .from('trade_proposals')
        .update(updateData)
        .eq('id', existingProposal.id);

      if (error) {
        console.error('Error updating trade with tracking info:', error);
        handleMessage('error', 'Failed to update trade with tracking information');
        return;
      }

      // Update the local state
      setExistingProposal(prev => ({
        ...prev!,
        ...updateData,
        updated_at: new Date().toISOString()
      }));

      // Refresh the trade proposal data using the memoized function
      await memoizedRefetchProposal();
    };

    // Execute the async function
    // Only run updateShippingInfo if we have all required data
    if (existingProposal && trackingNumber && carrier) {
      updateShippingInfo();
    }
  }, [
    existingProposal, 
    handleMessage,
    memoizedRefetchProposal,
    refetchProposal,
    isProposer,
    trackingNumber,
    carrier,
    labelUrl,
    supabase
  ]);

  // Handle modal close with cleanup
  const handleClose = useCallback(() => {
    // Reset any necessary state here
    setMessage(null);
    onClose();
  }, [onClose]);

  // Add a class to control the modal's visibility with transitions
  const modalClasses = `fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;
  const contentClasses = `bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-transform duration-300 ${isOpen ? 'scale-100' : 'scale-95'}`;

  // If not open, don't render the modal content at all
  if (!isOpen) return null;

  return (
    <div className={modalClasses} onClick={handleClose}>
      <div className={contentClasses} onClick={e => e.stopPropagation()}>
        {step === 'create_label' && existingProposal && user && (
          <ShippingModal
            isOpen={isShippingModalOpen}
            onClose={() => setShippingModalOpen(false)}
            tradeId={existingProposal.id}
            user={user}
            otherUser={otherUser}
            isProposer={user.id === existingProposal.proposer_id}
            onShippingComplete={handleShippingComplete}
            onShippingError={(error) => {
              setMessage({
                type: 'error',
                text: error
              });
            }}
            onSaveAddress={handleSaveAddress}
            onRequestRecipientAddress={handleRequestRecipientAddress}
            shippingPreferences={shippingPreferences}
            recipientShippingPreferences={recipientPrefs}
          />
        )}

        {step === 'waiting_for_label' && (
          <div className="text-center p-6 bg-white rounded-lg shadow">
            <div className="flex flex-col items-center">
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Waiting for Shipping Label</h3>
              <p className="text-gray-600 mb-4">
                {otherUser.username} is preparing the shipping label. 
                You'll receive a notification once it's ready.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-6 text-center p-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Trade Completed!</h3>
              <p className="text-gray-600">
                Your trade with {otherUser.username} has been successfully completed.
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-900 mb-2">Next Steps:</h4>
              {existingProposal?.shipping_method === 'mail' ? (
                <ul className="text-sm text-green-800 space-y-1 text-left">
                  <li>• Track your package using the provided tracking number</li>
                  <li>• Confirm receipt of the cards in the trade chat</li>
                  <li>• Rate your trading experience with {otherUser.username}</li>
                  <li>• Add the new cards to your collection</li>
                </ul>
              ) : (
                <ul className="text-sm text-green-800 space-y-1 text-left">
                  <li>• The trade has been marked as completed</li>
                  <li>• Rate your trading experience with {otherUser.username}</li>
                  <li>• Add the new cards to your collection</li>
                  <li>• Check your Profile page to see this completed trade</li>
                </ul>
              )}
            </div>

            <button
              onClick={onClose}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradeProposalModal;