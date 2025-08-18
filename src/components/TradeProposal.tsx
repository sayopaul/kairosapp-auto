import React, { useState, useEffect } from 'react';
import { ShippingPreference } from '../hooks/useShippingPreferences';
import { X, ArrowLeftRight, Check, Clock, MapPin, Truck, MessageCircle, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTradeProposals } from '../hooks/useTradeProposals';
import { useShippingPreferences } from '../hooks/useShippingPreferences';
import ShippingPreferenceForm from './ShippingPreferenceForm';
import { Card } from '../types';

interface TradeProposalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  matchScore: number;
  user1: {
    id: string;
    username: string;
    profile_image_url?: string;
  };
  user2: {
    id: string;
    username: string;
    profile_image_url?: string;
  };
  user1Card: Card | undefined;
  user2Card: Card | undefined;
  isBundle?: boolean;
  user1Cards?: Card[];
  user2Cards?: Card[];
}

const TradeProposal: React.FC<TradeProposalProps> = ({
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
}) => {
  const { user } = useAuth();
  const { 
    proposals,
    createProposal, 
    updateProposal,
    deleteProposal,
    updateTradeStatus,
    acceptProposal, 
    completeTradeProposal, 
    declineProposal, 
    updateShippingMethod,
    confirmShipping,
    loading 
  } = useTradeProposals(user?.id);
  const { shippingPreferences, loading: preferencesLoading } = useShippingPreferences(user?.id);
  
  // Find existing proposal for this match
  const existingProposal = proposals.find(p => p.match_id === matchId);
  
  const [step, setStep] = useState<'propose' | 'accept' | 'confirm' | 'shipping' | 'complete'>('propose');
  const [shippingMethod, setShippingMethod] = useState<'mail' | 'local_meetup' | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [message, setMessage] = useState<{type: 'success' | 'error' | 'info'; text: string} | null>(null);

  // Determine if current user is proposer or recipient
  const isProposer = existingProposal ? existingProposal.proposer_id === user?.id : user?.id === user1.id;
  const isRecipient = existingProposal ? existingProposal.recipient_id === user?.id : user?.id === user2.id;
  
  // Get the other user (for display purposes)
  const otherUser = isProposer ? user2 : user1;
  
  // Get the cards being traded
  const myCard = isProposer ? user1Card : user2Card;
  const theirCard = isProposer ? user2Card : user1Card;
  
  const myCards = isProposer ? user1Cards : user2Cards;
  const theirCards = isProposer ? user2Cards : user1Cards;

  // Set initial step based on existing proposal
  useEffect(() => {
    if (!existingProposal) {
      setStep('propose');
      return;
    }

    const status = existingProposal.status;
    
    if (status === 'proposed') {
      setStep(isRecipient ? 'accept' : 'propose');
    } else if (status === 'accepted_by_recipient') {
      setStep(isProposer ? 'confirm' : 'accept');
    } else if (status === 'confirmed') {
      setStep('shipping');
      setShippingMethod(existingProposal.shipping_method as 'mail' | 'local_meetup' | null);
    } else if (status === 'shipping_pending' || status === 'shipping_confirmed') {
      setStep('shipping');
      setShippingMethod(existingProposal.shipping_method as 'mail' | 'local_meetup' | null);
    } else if (status === 'completed') {
      setStep('complete');
    }
  }, [existingProposal, isProposer, isRecipient]);

  // Set default selected address
  useEffect(() => {
    if (shippingPreferences && shippingPreferences.length > 0) {
      const defaultAddress = shippingPreferences.find(p => p.is_default);
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      } else if (shippingPreferences[0]) {
        setSelectedAddressId(shippingPreferences[0].id);
      }
    }
  }, [shippingPreferences]);

  const handlePropose = async () => {
    if (!user) return;
    
    // Check if proposal already exists
    if (existingProposal) {
      setMessage({
        type: 'error',
        text: 'A trade proposal already exists for this match'
      });
      return;
    }
    
    try {
      setMessage(null);
      
      await createProposal({
        match_id: matchId,
        proposer_id: user.id,
        recipient_id: otherUser.id,
        status: 'proposed',
        tracking_number: undefined,
        carrier: undefined,
        label_url: undefined,
        shipping_method: undefined,
        completed_at: undefined,
        shipping_address_from: undefined,
        shipping_address_to: undefined,
        shipping_rate: undefined
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
    }
  };

  const handleAccept = async () => {
    if (!existingProposal) return;
    
    try {
      setMessage(null);
      
      await acceptProposal(existingProposal.id);
      
      setMessage({
        type: 'success',
        text: 'Trade proposal accepted!'
      });
      
      setStep('accept');
    } catch (error) {
      console.error('Error accepting trade:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to accept trade'
      });
    }
  };

  const handleConfirm = async () => {
    if (!existingProposal) return;
    
    try {
      setMessage(null);
      
      await acceptProposal(existingProposal.id);
      
      setMessage({
        type: 'success',
        text: 'Trade confirmed! Please select a shipping method.'
      });
      
      setStep('shipping');
    } catch (error) {
      console.error('Error confirming trade:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to confirm trade'
      });
    }
  };

  const handleDecline = async () => {
    if (!existingProposal) return;
    
    try {
      setMessage(null);
      
      await updateTradeStatus(existingProposal.id, 'declined');
      
      setMessage({
        type: 'info', 
        text: 'Trade proposal declined'
      });
      
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error declining trade:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to decline trade'
      });
    }
  };

  const handleDelete = async () => {
    if (!existingProposal) return;
    
    try {
      setMessage(null);
      
      await deleteProposal(existingProposal.id);
      
      setMessage({
        type: 'info',
        text: 'Trade proposal deleted'
      });
      
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error deleting trade:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete trade'
      });
    }
  };
  const handleSelectShippingMethod = async (method: 'mail' | 'local_meetup') => {
    if (!existingProposal) return;
    
    try {
      setMessage(null);
      setShippingMethod(method);
      
      await updateProposal(existingProposal.id, { shipping_method: method });
      
      setMessage({
        type: 'success',
        text: method === 'mail' 
          ? 'Mail selected as shipping method. Please confirm your shipping details.' 
          : 'Local meetup selected. Please coordinate with the other trader.'
      });
    } catch (error) {
      console.error('Error setting shipping method:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to set shipping method'
      });
    }
  };

  const handleConfirmShipping = async () => {
    if (!existingProposal) return;
    
    try {
      setMessage(null);
      
      if (shippingMethod === 'mail' && !selectedAddressId && shippingPreferences.length === 0) {
        setMessage({
          type: 'error',
          text: 'Please add a shipping address before confirming'
        });
        setShowAddressForm(true);
        return;
      }
      
      const updateField = isProposer ? 'proposer_shipping_confirmed' : 'recipient_shipping_confirmed';
      await updateProposal(existingProposal.id, { [updateField]: true });
      
      // Check if both users have confirmed shipping
      const bothConfirmed = isProposer 
        ? existingProposal.recipient_shipping_confirmed 
        : existingProposal.proposer_shipping_confirmed;

      if (bothConfirmed) {
        await completeTradeProposal(existingProposal.id);
        setStep('complete');
        setMessage({
          type: 'success',
          text: 'Trade completed successfully!'
        });
      } else {
        setMessage({
          type: 'success',
          text: 'Shipping confirmed! Waiting for the other trader to confirm.'
        });
      }
    } catch (error) {
      console.error('Error confirming shipping:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to confirm shipping'
      });
    }
  };

  const handleAddressFormSuccess = () => {
    setShowAddressForm(false);
  };

  const renderCardDetails = (card: Card | undefined) => {
    if (!card) return <div className="text-gray-500">Card details unavailable</div>;
    
    return (
      <div className="flex space-x-4">
        <img
          src={card.image_url || 'https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2'}
          alt={card.name}
          className="w-16 h-20 object-cover rounded-lg shadow-md"
        />
        <div className="flex-1">
          <h5 className="font-bold text-gray-900">{card.name}</h5>
          <p className="text-sm text-gray-600">#{card.card_number} • {card.set}</p>
          <p className="text-sm text-gray-600">{card.condition}</p>
          <p className="text-lg font-bold text-blue-600 mt-1">
            ${parseFloat(card.market_price.toString()).toFixed(2)}
          </p>
        </div>
      </div>
    );
  };

  const renderBundleCards = (cards: Card[]) => {
    if (!cards || cards.length === 0) return <div className="text-gray-500">Card details unavailable</div>;
    
    const totalValue = cards.reduce((sum, card) => sum + card.market_price, 0);
    
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {cards.map(card => (
            <div key={card.id} className="flex flex-col items-center w-20">
              <img
                src={card.image_url || 'https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2'}
                alt={card.name}
                className="w-16 h-20 object-cover rounded-lg shadow-md mb-1"
              />
              <span className="text-xs font-medium text-gray-900 text-center truncate w-full">{card.name}</span>
              <span className="text-xs text-gray-500">${card.market_price.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="text-right">
          <span className="text-sm text-gray-600">Total Value:</span>
          <span className="ml-2 text-lg font-bold text-blue-600">${totalValue.toFixed(2)}</span>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <ArrowLeftRight className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {step === 'propose' && !existingProposal && 'Propose Trade'}
                  {step === 'propose' && existingProposal && 'Trade Proposed'}
                  {step === 'accept' && 'Accept Trade'}
                  {step === 'confirm' && 'Confirm Trade'}
                  {step === 'shipping' && 'Shipping Details'}
                  {step === 'complete' && 'Trade Complete'}
                </h2>
                <p className="text-blue-100">
                  {step === 'propose' && !existingProposal && 'Initiate a trade with another user'}
                  {step === 'propose' && existingProposal && 'Waiting for response from the other trader'}
                  {step === 'accept' && 'Review and accept the trade proposal'}
                  {step === 'confirm' && 'Final confirmation of the trade'}
                  {step === 'shipping' && 'Select shipping method and confirm details'}
                  {step === 'complete' && 'Trade has been successfully completed'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Message Display */}
          {message && (
            <div className={`flex items-center space-x-3 p-4 rounded-lg border mb-6 ${
              message.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : message.type === 'info'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
              ) : message.type === 'info' ? (
                <Clock className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          {/* Trade Details */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Trade Details</h3>
              <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">{matchScore}% Match</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Your Card(s) */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center space-x-2">
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>Your {isBundle ? 'Cards' : 'Card'}</span>
                  {isBundle && <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full ml-2">BUNDLE</span>}
                </h4>
                {isBundle ? renderBundleCards(myCards) : renderCardDetails(myCard)}
              </div>

              {/* Their Card(s) */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>Their {isBundle ? 'Cards' : 'Card'}</span>
                  {isBundle && <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full ml-2">BUNDLE</span>}
                </h4>
                {isBundle ? renderBundleCards(theirCards) : renderCardDetails(theirCard)}
              </div>
            </div>
          </div>

          {/* Step Content */}
          {step === 'propose' && !existingProposal && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Trade Proposal Information</h4>
                    <p className="text-sm text-blue-800 mt-1">
                      You're about to propose a trade with {otherUser.username}. Once proposed, they'll be notified and can accept or decline your offer.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handlePropose}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Proposing Trade...</span>
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="h-5 w-5" />
                      <span>Propose Trade</span>
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === 'propose' && existingProposal && (
            <div className="space-y-6">
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Waiting for Response</h4>
                    <p className="text-sm text-yellow-800 mt-1">
                      Your trade proposal has been sent to {otherUser.username}. You'll be notified when they respond.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handleDecline}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <>
                      <X className="h-5 w-5" />
                      <span>Decline Proposal</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <span>Delete</span>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <span>Delete</span>
                    )}
                  </button>
                  Close
                </button>
              </div>
            </div>
          )}

          {step === 'accept' && existingProposal && (
            <div className="space-y-6">
              {existingProposal.status === 'accepted_by_recipient' ? (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-900">Trade Accepted</h4>
                      <p className="text-sm text-green-800 mt-1">
                        You've accepted this trade. Waiting for {otherUser.username} to confirm.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900">Trade Proposal Received</h4>
                      <p className="text-sm text-blue-800 mt-1">
                        {otherUser.username} has proposed a trade with you. Review the details and decide if you want to accept.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-4">
                {existingProposal.status !== 'accepted_by_recipient' && (
                  <button
                    onClick={handleAccept}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Accepting...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-5 w-5" />
                        <span>Accept Trade</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={existingProposal.status === 'accepted_by_recipient' ? onClose : handleDecline}
                  disabled={loading}
                  className={`flex-1 flex items-center justify-center space-x-2 px-6 py-3 ${
                    existingProposal.status === 'accepted_by_recipient'
                    ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'bg-red-600 text-white hover:bg-red-700'
                  } rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      {existingProposal.status === 'accepted_by_recipient' ? (
                        <span>Close</span>
                      ) : (
                        <>
                          <X className="h-5 w-5" />
                          <span>Decline Trade</span>
                        </>
                      )}
                    </>
                  )}
                </button>
                {existingProposal.status !== 'accepted_by_recipient' && (
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <span>Delete</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'confirm' && existingProposal && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Final Confirmation</h4>
                    <p className="text-sm text-blue-800 mt-1">
                      {otherUser.username} has accepted your trade proposal. Please confirm to proceed with the trade.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      <span>Confirm Trade</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleDecline}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <>
                      <X className="h-5 w-5" />
                      <span>Cancel Trade</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'shipping' && existingProposal && (
            <div className="space-y-6">
              {/* Shipping Method Selection */}
              {!existingProposal.shipping_method && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Shipping Method</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div
                      onClick={() => handleSelectShippingMethod('mail')}
                      className="p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md border-gray-200 hover:border-blue-300"
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Truck className="h-5 w-5 text-blue-600" />
                        </div>
                        <h4 className="font-semibold text-gray-900">Mail</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        Ship cards via USPS, UPS, or other carriers. Generate shipping labels and track packages.
                      </p>
                    </div>
                    
                    <div
                      onClick={() => handleSelectShippingMethod('local_meetup')}
                      className="p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md border-gray-200 hover:border-blue-300"
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <MapPin className="h-5 w-5 text-green-600" />
                        </div>
                        <h4 className="font-semibold text-gray-900">Local Meetup</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        Meet in person to exchange cards. Coordinate a safe, public location with the other trader.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mail Shipping Details */}
              {existingProposal.shipping_method === 'mail' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipping Details</h3>
                  
                  {/* Shipping Address Selection */}
                  {!showAddressForm && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Your Shipping Address</h4>
                        <button
                          onClick={() => setShowAddressForm(true)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          {shippingPreferences && shippingPreferences.length > 0 ? 'Add New Address' : 'Add Address'}
                        </button>
                      </div>
                      
                      {preferencesLoading ? (
                        <div className="animate-pulse h-32 bg-gray-200 rounded-lg"></div>
                      ) : shippingPreferences && shippingPreferences.length > 0 ? (
                        <div className="space-y-3">
                          {shippingPreferences.map((address: ShippingPreference) => (
                            <div
                              key={address.id}
                              onClick={() => setSelectedAddressId(address.id)}
                              className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                                selectedAddressId === address.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <h5 className="font-medium text-gray-900">{address.address_name}</h5>
                                  <p className="text-sm text-gray-600">
                                    {address.street1}{address.street2 ? `, ${address.street2}` : ''}, {address.city}, {address.state} {address.zip}
                                  </p>
                                </div>
                                {selectedAddressId === address.id && (
                                  <Check className="h-5 w-5 text-blue-600" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                          <div className="flex items-start space-x-3">
                            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                            <div>
                              <h4 className="font-medium text-yellow-900">No Shipping Addresses</h4>
                              <p className="text-sm text-yellow-800 mt-1">
                                Please add a shipping address to continue with the trade.
                              </p>
                              <button
                                onClick={() => setShowAddressForm(true)}
                                className="mt-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors duration-200"
                              >
                                Add Address
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Address Form */}
                  {showAddressForm && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Add Shipping Address</h4>
                        <button
                          onClick={() => setShowAddressForm(false)}
                          className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                      
                      <ShippingPreferenceForm
                        onSave={handleAddressFormSuccess}
                      />
                    </div>
                  )}

                  {/* Shipping Instructions */}
                  {!showAddressForm && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
                      <h4 className="font-medium text-blue-900 mb-2">Shipping Instructions</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Package cards securely with protective sleeves and rigid mailers</li>
                        <li>• Include a note with your username and trade details</li>
                        <li>• Use tracking and insurance for valuable cards</li>
                        <li>• Share tracking information in the trade chat</li>
                        <li>• Keep your shipping receipt until delivery is confirmed</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Local Meetup Details */}
              {existingProposal.shipping_method === 'local_meetup' && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Local Meetup</h3>
                  
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-900 mb-2">Meetup Safety Guidelines</h4>
                    <ul className="text-sm text-green-800 space-y-1">
                      <li>• Always meet in a public place (coffee shops, card stores, malls)</li>
                      <li>• Consider meeting during daylight hours</li>
                      <li>• Let someone know where you're going and who you're meeting</li>
                      <li>• Bring a friend if possible</li>
                      <li>• Inspect cards carefully before completing the trade</li>
                      <li>• Use the chat feature to coordinate meeting details</li>
                    </ul>
                  </div>
                  
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => window.location.hash = '#chat'}
                      className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                    >
                      <MessageCircle className="h-5 w-5" />
                      <span>Open Chat to Coordinate</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Shipping Button */}
              {existingProposal.shipping_method && (
                <div className="space-y-4">
                  <div className="flex space-x-4">
                    <button
                      onClick={handleConfirmShipping}
                      disabled={loading || (existingProposal.shipping_method === 'mail' && !selectedAddressId && shippingPreferences.length === 0) || 
                        (isProposer ? existingProposal.proposer_shipping_confirmed : existingProposal.recipient_shipping_confirmed)}
                      className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Processing...</span>
                        </>
                      ) : (isProposer ? existingProposal.proposer_shipping_confirmed : existingProposal.recipient_shipping_confirmed) ? (
                        <>
                          <CheckCircle className="h-5 w-5" />
                          <span>Shipping Confirmed</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-5 w-5" />
                          <span>Confirm {existingProposal.shipping_method === 'mail' ? 'Shipping' : 'Meetup'}</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={onClose}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                    >
                      Close
                    </button>
                  </div>
                  
                  <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">After Meeting in Person</h4>
                    <p className="text-sm text-blue-800 mb-3">
                      Once you've met and exchanged cards, both users should confirm the trade was completed.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          const updateField = isProposer ? 'proposer_shipping_confirmed' : 'recipient_shipping_confirmed';
                          await updateProposal(existingProposal.id, { [updateField]: true });
                          
                          const bothConfirmed = isProposer 
                            ? existingProposal.recipient_shipping_confirmed 
                            : existingProposal.proposer_shipping_confirmed;

                          if (bothConfirmed) {
                            await completeTradeProposal(existingProposal.id);
                            setStep('complete');
                          }
                          
                          setMessage({
                            type: 'success',
                            text: bothConfirmed ? 'Trade completed!' : 'Confirmed! Waiting for other trader to confirm.'
                          });
                        } catch (error) {
                          setMessage({
                            type: 'error',
                            text: 'Failed to confirm meetup completion'
                          });
                        }
                      }}
                      disabled={loading || (isProposer ? existingProposal.proposer_shipping_confirmed : existingProposal.recipient_shipping_confirmed)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
                    >
                      {(isProposer ? existingProposal.proposer_shipping_confirmed : existingProposal.recipient_shipping_confirmed) 
                        ? 'Meetup Confirmed' 
                        : 'Confirm Meetup Completed'
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-6 text-center">
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
                    <li>• Coordinate a meetup time and location with {otherUser.username}</li>
                    <li>• Confirm the trade was completed in the trade chat</li>
                    <li>• Rate your trading experience with {otherUser.username}</li>
                    <li>• Add the new cards to your collection</li>
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
    </div>
  );
};

export default TradeProposal;