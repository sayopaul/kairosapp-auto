import React, { useState } from 'react';
import { Gift, X, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTradeProposals } from '../hooks/useTradeProposals';
import { useNotifications } from '../hooks/useNotifications';
import TradeProposalModal from './TradeProposalModal';
import type { Card, Notification } from '../hooks/useNotifications';

const TradeProposalNotification: React.FC = () => {
  const { user } = useAuth();
  const { notifications, markAsRead } = useNotifications();
  const { proposals } = useTradeProposals(user?.id);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

  const handleDismiss = (notificationId: string) => {
    markAsRead(notificationId);
  };

  const handleViewProposal = (proposalId: string) => {
    setSelectedProposalId(proposalId);
  };

  const handleCloseModal = () => {
    setSelectedProposalId(null);
  };

  const renderTradeDetails = (notification: Notification) => {
    const proposal = proposals.find(p => p.id === notification.relatedId);
    if (!proposal?.match) return null;

    // Determine if this is a bundle trade
    const isBundle = proposal.match.is_bundle || 
      (Array.isArray(proposal.match.user1_card_ids) && proposal.match.user1_card_ids.length > 1) ||
      (Array.isArray(proposal.match.user2_card_ids) && proposal.match.user2_card_ids.length > 1);

    // Get cards from notification data with default empty arrays
    const myCards = notification.myCards || [];
    const theirCards = notification.theirCards || [];

    if (isBundle) {
      // Calculate total values with null checks
      const myTotal = myCards.reduce((sum, card) => sum + (parseFloat(card.market_price || '0')), 0);
      const theirTotal = theirCards.reduce((sum, card) => sum + (parseFloat(card.market_price || '0')), 0);

      return (
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="relative">
              <img
                src={theirCards[0]?.image_url || '/placeholder-card.png'}
                alt="Bundle Preview"
                className="w-12 h-16 object-cover rounded shadow-sm"
              />
              <span className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full">
                {theirCards.length}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                Bundle Trade
              </h4>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                BUNDLE
              </span>
            </div>
            <div className="mt-1 flex items-center text-sm text-gray-500">
              <ArrowLeftRight className="h-4 w-4 mr-1" />
              <span>{theirCards.length} cards (${theirTotal.toFixed(2)}) ↔️ {myCards.length} cards (${myTotal.toFixed(2)})</span>
            </div>
          </div>
        </div>
      );
    }

    // Single card trade display
    return (
      <div className="flex items-center space-x-4">
        <img
          src={theirCards[0]?.image_url || '/placeholder-card.png'}
          alt={theirCards[0]?.name || 'Card'}
          className="w-12 h-16 object-cover rounded shadow-sm"
        />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {theirCards[0]?.name || 'Card'}
          </h4>
          <p className="mt-1 text-sm text-gray-500">
            ${parseFloat(theirCards[0]?.market_price || '0').toFixed(2)}
          </p>
        </div>
      </div>
    );
  };

  const selectedProposal = selectedProposalId 
    ? proposals.find(p => p.id === selectedProposalId)
    : null;

  // This component is now a no-op. All trade proposal notifications are handled by the global pop-up notification system.
  return null;
};

export default TradeProposalNotification;