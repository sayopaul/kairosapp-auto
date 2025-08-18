import React, { useState, useEffect } from 'react';
import { Bell, X, Zap, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAutoMatching } from '../hooks/useAutoMatching';

const AutoMatchingNotification: React.FC = () => {
  const { user } = useAuth();
  const { recentMatches, loading } = useAutoMatching(user?.id);
  const [showNotification, setShowNotification] = useState(false);
  const [dismissedMatches, setDismissedMatches] = useState<Set<string>>(new Set());

  // Show notification when new matches are found
  useEffect(() => {
    if (recentMatches.length > 0) {
      const newMatches = recentMatches.filter(match => !dismissedMatches.has(match.id));
      if (newMatches.length > 0) {
        setShowNotification(true);
      }
    }
  }, [recentMatches, dismissedMatches]);

  const handleDismiss = () => {
    setShowNotification(false);
    // Mark current matches as dismissed
    const newDismissed = new Set(dismissedMatches);
    recentMatches.forEach(match => newDismissed.add(match.id));
    setDismissedMatches(newDismissed);
  };

  const getMatchDescription = (match: any) => {
    const isUser1 = match.user1_id === user?.id;
    const isBundle = match.is_bundle;
    let myCards, theirCards;
    if (isBundle) {
      myCards = isUser1 ? match.user1_cards : match.user2_cards;
      theirCards = isUser1 ? match.user2_cards : match.user1_cards;
      return {
        otherUser: isUser1 ? match.user2?.username : match.user1?.username,
        myCard: myCards && myCards.length > 0 ? myCards.map((c: any) => c.name).join(', ') : 'Unknown Card(s)',
        theirCard: theirCards && theirCards.length > 0 ? theirCards.map((c: any) => c.name).join(', ') : 'Unknown Card(s)',
        score: match.match_score || 0
      };
    } else {
      const otherUser = isUser1 ? match.user2?.username : match.user1?.username;
      const myCard = isUser1 ? match.user1_card?.name : match.user2_card?.name;
      const theirCard = isUser1 ? match.user2_card?.name : match.user1_card?.name;
      return {
        otherUser: otherUser || 'Unknown User',
        myCard: myCard || 'Unknown Card',
        theirCard: theirCard || 'Unknown Card',
        score: match.match_score || 0
      };
    }
  };

  if (!showNotification || recentMatches.length === 0 || !user) {
    return null;
  }

  const latestMatch = recentMatches[0];
  const matchInfo = getMatchDescription(latestMatch);

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-slide-in-right">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1 bg-white/20 rounded-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">New Match Found!</h3>
                <p className="text-green-100 text-sm">Auto-matching system</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors duration-200"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-center space-x-3 mb-3">
            <div className="flex-1">
              <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                <span>Trading with</span>
                <span className="font-semibold text-gray-900">{matchInfo.otherUser}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="font-medium text-blue-600">{matchInfo.myCard}</span>
                <ArrowRight className="h-3 w-3 text-gray-400" />
                <span className="font-medium text-green-600">{matchInfo.theirCard}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-green-600">{matchInfo.score}%</div>
              <div className="text-xs text-gray-500">Match</div>
            </div>
          </div>

          {recentMatches.length > 1 && (
            <div className="text-xs text-gray-500 mb-3">
              +{recentMatches.length - 1} more matches found
            </div>
          )}

          <div className="flex space-x-2">
            <button
              onClick={() => {
                // Navigate to matches page
                window.location.hash = '#matches';
                handleDismiss();
              }}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
            >
              View All Matches
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* Auto-matching indicator */}
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-100">
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span>Automatically detected when you added a card</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoMatchingNotification;