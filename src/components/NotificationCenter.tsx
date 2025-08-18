import React, { useState } from 'react';
import { Bell, X, Check, ArrowLeftRight, MessageCircle, Truck, CheckCircle } from 'lucide-react';
import { useNotifications, Notification } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import TradeProposalModal from './TradeProposalModal';
import { useTradeProposals } from '../hooks/useTradeProposals';
import { useMatches } from '../hooks/useMatches';

const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { proposals } = useTradeProposals(user?.id);
  const { matches } = useMatches(user?.id);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      markAllAsRead();
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    if (notification.type === 'trade_proposal' || notification.type === 'trade_accepted') {
      setSelectedProposal(notification.relatedId || null);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'trade_proposal':
        return <ArrowLeftRight className="h-5 w-5 text-blue-500" />;
      case 'trade_accepted':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'trade_confirmed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'shipping_update':
        return <Truck className="h-5 w-5 text-purple-500" />;
      case 'message':
        return <MessageCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getMatchDetailsForProposal = (proposalId: string) => {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return null;
    
    return matches.find(m => m.id === proposal.match_id);
  };

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={toggleOpen}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 relative"
        >
          <Bell className="h-6 w-6 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p>No notifications</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors duration-200 ${
                      !notification.isRead ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-gray-100 rounded-full">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{notification.title}</h4>
                        <p className="text-sm text-gray-600">{notification.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-800 py-1"
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trade Proposal Modal */}
      {selectedProposal && (
        <TradeProposalModal
          isOpen={true}
          onClose={() => setSelectedProposal(null)}
          matchId={getMatchDetailsForProposal(selectedProposal)?.id || ''}
          matchScore={getMatchDetailsForProposal(selectedProposal)?.match_score || 0}
          user1={{
            id: getMatchDetailsForProposal(selectedProposal)?.user1_id || '',
            username: getMatchDetailsForProposal(selectedProposal)?.user1?.username || 'Unknown',
            profile_image_url: getMatchDetailsForProposal(selectedProposal)?.user1?.profile_image_url
          }}
          user2={{
            id: getMatchDetailsForProposal(selectedProposal)?.user2_id || '',
            username: getMatchDetailsForProposal(selectedProposal)?.user2?.username || 'Unknown',
            profile_image_url: getMatchDetailsForProposal(selectedProposal)?.user2?.profile_image_url
          }}
          user1Card={getMatchDetailsForProposal(selectedProposal)?.user1_card}
          user2Card={getMatchDetailsForProposal(selectedProposal)?.user2_card}
          isBundle={getMatchDetailsForProposal(selectedProposal)?.is_bundle}
          user1Cards={getMatchDetailsForProposal(selectedProposal)?.user1_cards}
          user2Cards={getMatchDetailsForProposal(selectedProposal)?.user2_cards}
        />
      )}
    </>
  );
};

export default NotificationCenter;