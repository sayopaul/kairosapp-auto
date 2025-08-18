import React, { useState } from 'react';
import CardItem from './CardItem';
import AddCard from './AddCard';
import CsvUpload from './CsvUpload';
import { Plus, Upload, Crown, FileText } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCards } from '../hooks/useCards';
import { useSubscriptionLimits } from '../hooks/useSubscriptionLimits';

const Trades: React.FC = () => {
  const { user } = useAuth();
  const { cards: tradeCards, loading, deleteCard, refetch } = useCards(user?.id, 'trade');
  const { canUseFeature, limits, currentTier } = useSubscriptionLimits(user?.id);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showCsvUpload, setShowCsvUpload] = useState(false);

  const handleRemoveCard = async (cardId: string) => {
    try {
      await deleteCard(cardId);
    } catch (error) {
      console.error('Failed to remove card:', error);
    }
  };

  const handleAddCardSuccess = () => {
    setShowAddCard(false);
    setShowCsvUpload(false);
    if (typeof refetch === 'function') refetch();
  };

  const totalValue = tradeCards.reduce((sum, card) => sum + (card.market_price * card.quantity), 0);
  const bulkUploadCheck = canUseFeature('canUseBulkUpload');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 opacity-10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Your Trade Cards</h1>
          <p className="text-gray-300 text-lg">Cards available for trading</p>
          <div className="mt-4 flex items-center space-x-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
              <span className="text-sm text-gray-300">Total Cards:</span>
              <span className="ml-2 text-xl font-bold">{tradeCards.length}</span>
              {limits.maxTradeCards !== Infinity && (
                <span className="text-sm text-gray-400">/{limits.maxTradeCards}</span>
              )}
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
              <span className="text-sm text-gray-300">Total Value:</span>
              <span className="ml-2 text-xl font-bold">${totalValue.toFixed(2)}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
              <span className="text-sm text-gray-300">Tier:</span>
              <span className="ml-2 text-xl font-bold capitalize">
                {currentTier === 'trainer' ? 'Free' : currentTier === 'elite' ? 'Elite' : 'Master'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Limit Warning */}
      {limits.maxTradeCards !== Infinity && tradeCards.length >= limits.maxTradeCards * 0.9 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Crown className="h-5 w-5 text-orange-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-orange-900">
                {tradeCards.length >= limits.maxTradeCards ? 'Trade Card Limit Reached' : 'Approaching Trade Card Limit'}
              </h3>
              <p className="text-orange-800 text-sm mt-1">
                You have {tradeCards.length} of {limits.maxTradeCards} trade cards. 
                {tradeCards.length >= limits.maxTradeCards 
                  ? ' Upgrade to add more cards.' 
                  : ' Consider upgrading for unlimited cards.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <button 
          onClick={() => setShowAddCard(true)}
          className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Plus className="h-5 w-5" />
          <span className="font-medium">Add New Card</span>
        </button>
        
        <button 
          onClick={() => setShowCsvUpload(true)}
          disabled={!bulkUploadCheck.allowed}
          className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl ${
            bulkUploadCheck.allowed
              ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={!bulkUploadCheck.allowed ? bulkUploadCheck.message : 'Upload multiple cards at once'}
        >
          <FileText className="h-5 w-5" />
          <span className="font-medium">CSV Upload</span>
          {!bulkUploadCheck.allowed && (
            <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded-full ml-2">Pro</span>
          )}
        </button>
      </div>

      {tradeCards.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <Plus className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No cards for trade yet</h3>
          <p className="text-gray-600 mb-4">Add some cards to start trading with other collectors</p>
          <button 
            onClick={() => setShowAddCard(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Add Your First Card
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tradeCards.map(card => (
            <CardItem
              key={card.id}
              card={card}
              onRemove={handleRemoveCard}
              showActions={true}
            />
          ))}
        </div>
      )}

      {/* Add Card Modal */}
      {showAddCard && (
        <AddCard
          onClose={() => setShowAddCard(false)}
          onSuccess={handleAddCardSuccess}
          defaultListType="trade"
        />
      )}

      {/* CSV Upload Modal */}
      {showCsvUpload && (
        <CsvUpload
          isOpen={showCsvUpload}
          onClose={() => setShowCsvUpload(false)}
          onSuccess={handleAddCardSuccess}
          defaultListType="trade"
        />
      )}
    </div>
  );
};

export default Trades;