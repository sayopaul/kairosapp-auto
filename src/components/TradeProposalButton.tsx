import React, { useState } from 'react';
import { ArrowLeftRight, Check, X, Clock, Truck, MapPin, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTradeProposals } from '../hooks/useTradeProposals';
import { TradeProposal, TradeMatch, PotentialMatch } from '../types';
import TradeProposalModal from './TradeProposalModal';

interface TradeProposalButtonProps {
  match: TradeMatch | PotentialMatch;
  onProposalUpdate?: () => void;
}

const TradeProposalButton: React.FC<TradeProposalButtonProps> = ({ match, onProposalUpdate }) => {
  const { user } = useAuth();
  const { getProposalForMatch, createProposal, updateProposal, loading } = useTradeProposals(user?.id);
  const [showModal, setShowModal] = useState(false);

  const handleProposeClick = () => {
    console.log("SHow proposal clicked")
    setShowModal(true);
  };

  // Get existing proposal for this match
  const proposal = getProposalForMatch(match.id);
  
  // Determine if current user is proposer or recipient
  const isProposer = proposal && user?.id === proposal.proposer_id;
  const isRecipient = proposal && user?.id === proposal.recipient_id;
  
  // Type guard to check if match is a TradeMatch
  const isTradeMatch = (match: TradeMatch | PotentialMatch): match is TradeMatch => {
    return 'user1_card_id' in match && 'user2_card_id' in match;
  };

  // Determine button state based on proposal status
  const getButtonState = () => {
    if (!proposal) {
      return {
        text: 'Propose Trade',
        icon: ArrowLeftRight,
        color: 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
        action: handleProposeClick
      };
    }
    
    switch (proposal.status) {
      case 'proposed':
        if (isRecipient) {
          return {
            text: 'Respond to Proposal',
            icon: Clock,
            color: 'from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800',
            action: handleProposeClick
          };
        } else {
          return {
            text: 'Awaiting Response',
            icon: Clock,
            color: 'from-gray-500 to-gray-600',
            disabled: true,
            action: handleProposeClick
          };
        }
      case 'accepted_by_recipient':
        if (isProposer) {
          return {
            text: 'Confirm Trade',
            icon: Check,
            color: 'from-green-600 to-green-700 hover:from-green-700 hover:to-green-800',
            action: handleProposeClick
          };
        } else {
          return {
            text: 'Awaiting Confirmation',
            icon: Clock,
            color: 'from-gray-500 to-gray-600',
            disabled: true,
            action: handleProposeClick
          };
        }
      case 'confirmed':
        return {
          text: 'Select Shipping Method',
          icon: Truck,
          color: 'from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800',
          action: handleProposeClick
        };
      case 'shipping_pending':
        if ((isProposer && !proposal.proposer_shipping_confirmed) || 
            (isRecipient && !proposal.recipient_shipping_confirmed)) {
          return {
            text: 'Confirm Shipping',
            icon: Truck,
            color: 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
            action: handleProposeClick
          };
        } else {
          return {
            text: 'Awaiting Shipping',
            icon: Clock,
            color: 'from-gray-500 to-gray-600',
            disabled: true,
            action: handleProposeClick
          };
        }
      case 'shipping_confirmed':
        return {
          text: 'Trade Complete',
          icon: Check,
          color: 'from-green-600 to-green-700',
          disabled: true,
          action: handleProposeClick
        };
      case 'completed':
        return {
          text: 'Trade Complete',
          icon: Check,
          color: 'from-green-600 to-green-700',
          disabled: true,
          action: handleProposeClick
        };
      case 'declined':
        return {
          text: 'Trade Declined',
          icon: X,
          color: 'from-red-600 to-red-700',
          disabled: true,
          action: handleProposeClick
        };
      case 'cancelled':
        return {
          text: 'Trade Cancelled',
          icon: X,
          color: 'from-red-600 to-red-700',
          disabled: true,
          action: handleProposeClick
        };
      default:
        return {
          text: 'Propose Trade',
          icon: ArrowLeftRight,
          color: 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
          action: handleProposeClick
        };
    }
  };
  
  const buttonState = getButtonState();
  const Icon = buttonState.icon;
  
  const handleModalClose = () => {
    setShowModal(false);
    if (onProposalUpdate) {
      onProposalUpdate();
    }
  };
  
  const handleCreateProposal = async () => {
    if (!user) return;
    
    try {
      const recipientId = match.user1_id === user.id ? match.user2_id : match.user1_id;
      
      await createProposal({
        match_id: match.id,
        proposer_id: user.id,
        recipient_id: recipientId,
        status: 'proposed'
      });
      
      if (onProposalUpdate) {
        onProposalUpdate();
      }
    } catch (error) {
      console.error('Error creating proposal:', error);
    }
  };
  
  return (
    <>
      <button
        onClick={buttonState.action}
        disabled={buttonState.disabled || loading || !user}
        className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r ${buttonState.color} text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Icon className="h-5 w-5" />
        )}
        <span className="font-medium">{buttonState.text}</span>
      </button>
      
      {showModal && (
        <TradeProposalModal
          isOpen={true}
          onClose={handleModalClose}
          matchId={match.id}
          matchScore={isTradeMatch(match) ? match.match_score || 0 : 0}
          user1={{
            id: match.user1_id,
            username: match.user1?.username || 'Unknown',
            profile_image_url: match.user1?.profile_image_url
          }}
          user2={{
            id: match.user2_id || '',
            username: match.user2?.username || 'Unknown',
            profile_image_url: match.user2?.profile_image_url
          }}
          user1Card={!match.is_bundle ? (isTradeMatch(match) ? match.user1_card : match.user1_cards?.[0]) : undefined}
          user2Card={!match.is_bundle ? (isTradeMatch(match) ? match.user2_card : match.user2_cards?.[0]) : undefined}
          isBundle={match.is_bundle}
          user1Cards={match.user1_cards}
          user2Cards={match.user2_cards}
        />
      )}
    </>
  );
};

export default TradeProposalButton;