import React, { useState } from 'react';
import CardItem from './CardItem';
import { Filter, Search, BarChart3 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCards } from '../hooks/useCards';
import { JustTcgApiService } from '../services/justTcgApiService';

const Collection: React.FC = () => {
  const { user } = useAuth();
  const { cards, loading } = useCards(user?.id);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'trade' | 'want'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingPrices, setUpdatingPrices] = useState(false);

  const filteredCards = cards.filter(card => {
    const matchesFilter = selectedFilter === 'all' || card.list_type === selectedFilter;
    const matchesSearch = card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         card.set.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalValue = cards.reduce((sum, card) => sum + (card.market_price * card.quantity), 0);
  const tradeValue = cards.filter(c => c.list_type === 'trade').reduce((sum, card) => sum + (card.market_price * card.quantity), 0);
  const wantValue = cards.filter(c => c.list_type === 'want').reduce((sum, card) => sum + (card.market_price * card.quantity), 0);

  const handleUpdateAllPrices = async () => {
    setUpdatingPrices(true);
    try {
      console.log('🔄 Updating prices for all cards using JustTCG API...');
      const pricingResults = await JustTcgApiService.batchUpdatePricing(cards);
      console.log('✅ Updated pricing for', pricingResults.size, 'cards');
      
      // Trigger a re-render by updating a state
      // In a real app, you'd update the cards in your state/database
      setTimeout(() => {
        window.location.reload(); // Simple refresh for demo
      }, 1000);
    } catch (error) {
      console.error('❌ Failed to update prices:', error);
    } finally {
      setUpdatingPrices(false);
    }
  };
  
  const stats = [
    { label: 'Total Collection', value: `$${totalValue.toFixed(2)}`, count: cards.length },
    { label: 'Trade Cards', value: `$${tradeValue.toFixed(2)}`, count: cards.filter(c => c.list_type === 'trade').length },
    { label: 'Want Cards', value: `$${wantValue.toFixed(2)}`, count: cards.filter(c => c.list_type === 'want').length },
  ];

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
          <div className="flex items-center space-x-3 mb-2">
            <BarChart3 className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Your Collection</h1>
          </div>
          <p className="text-gray-300 text-lg">Complete overview of your trading card collection</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2">{stat.label}</h3>
            <p className="text-2xl font-bold text-blue-600 mb-1">{stat.value}</p>
            <p className="text-sm text-gray-600">{stat.count} cards</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value as 'all' | 'trade' | 'want')}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Cards</option>
              <option value="trade">Trade Cards</option>
              <option value="want">Want Cards</option>
            </select>
          </div>
          
          <button
            onClick={handleUpdateAllPrices}
            disabled={updatingPrices}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
          >
            {updatingPrices ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Updating...</span>
              </>
            ) : (
              <>
                <span>Update Prices</span>
              </>
            )}
          </button>
        </div>

        {filteredCards.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <Search className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No cards found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCards.map(card => (
              <div key={card.id} className="relative">
                <CardItem card={card} showActions={false} />
                <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${
                  card.list_type === 'trade' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {card.list_type === 'trade' ? 'Trade' : 'Want'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Collection;