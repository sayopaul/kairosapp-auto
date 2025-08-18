import React, { useState, useEffect } from 'react';
import { MessageCircle, ArrowLeftRight, TrendingUp, Zap, Brain, Target, RefreshCw, Filter, AlertCircle, Plus, DollarSign, Users, Award, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useMatches } from '../hooks/useMatches';
import { useEnhancedMatching } from '../hooks/useEnhancedMatching';
import TradeProposalButton from './TradeProposalButton';
import { useCards } from '../hooks/useCards';
import { useTradeProposals } from '../hooks/useTradeProposals';
import TradeProposalButton from './TradeProposalButton';
import { useTradeProposals } from '../hooks/useTradeProposals';
import TradeProposalButton from './TradeProposalButton';
import MatchingEngine from './MatchingEngine';
import TradeProposalButton from './TradeProposalButton';

const EnhancedMatches: React.FC = () => {
  const { user } = useAuth();
  const { matches: savedMatches, loading: savedLoading } = useMatches(user?.id);
  const { matches: enhancedMatches, loading: enhancedLoading, error: matchingError, generateMatches } = useEnhancedMatching(user?.id);
  const { cards: tradeCards } = useCards(user?.id, 'trade');
  const { cards: wantCards } = useCards(user?.id, 'want');
  const { proposals } = useTradeProposals(user?.id);
  const { proposals, refetchProposals } = useTradeProposals(user?.id);
  const [showEngine, setShowEngine] = useState(false);
  const [filterConfidence, setFilterConfidence] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Use enhanced matches if available, otherwise use saved matches
  const matches = enhancedMatches.length > 0 ? enhancedMatches : savedMatches;
  const loading = enhancedLoading || savedLoading;

  // Auto-generate matches when component loads
  useEffect(() => {
    if (user?.id && tradeCards.length > 0 && wantCards.length > 0) {
      console.log('Auto-generating enhanced matches on component load');
      generateMatches();
    }
  }, [user?.id, tradeCards.length, wantCards.length]);

  const filteredMatches = matches.filter(match => {
    if (filterConfidence === 'all') return true;
    
    // Determine confidence based on match score
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (match.match_score >= 85) confidence = 'high';
    else if (match.match_score >= 70) confidence = 'medium';
    
    return confidence === filterConfidence;
  });

  const getMatchStrengthColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 70) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getMatchStrengthLabel = (score: number) => {
    if (score >= 85) return 'Excellent Match';
    if (score >= 70) return 'Good Match';
    if (score >= 60) return 'Fair Match';
    return 'Poor Match';
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 85) return <Target className="h-4 w-4" />;
    if (score >= 70) return <TrendingUp className="h-4 w-4" />;
    return <ArrowLeftRight className="h-4 w-4" />;
  };

  const getMutualBenefitColor = (score: number) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-blue-600';
    if (score >= 25) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleGenerateMatches = () => {
    console.log('Manual enhanced match generation triggered');
    generateMatches();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing mutually beneficial trades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 opacity-10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <Zap className="h-8 w-8" />
                <h1 className="text-3xl font-bold">Enhanced AI Matching</h1>
              </div>
              <p className="text-gray-300 text-lg">Mutually beneficial trades with loosened criteria for testing</p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowEngine(!showEngine)}
                className="flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg hover:bg-white/20 transition-all duration-200"
              >
                <Brain className="h-5 w-5" />
                <span>Matching Engine</span>
              </button>
              
              <button
                onClick={handleGenerateMatches}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                <span>Generate Matches</span>
              </button>
            </div>
          </div>
          
          <div className="mt-4 flex items-center space-x-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
              <span className="text-sm text-gray-300">Mutual Matches:</span>
              <span className="ml-2 text-xl font-bold">{filteredMatches.length}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
              <span className="text-sm text-gray-300">Trade Cards:</span>
              <span className="ml-2 text-xl font-bold">{tradeCards.length}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
              <span className="text-sm text-gray-300">Want Cards:</span>
              <span className="ml-2 text-xl font-bold">{wantCards.length}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
              <span className="text-sm text-gray-300">Criteria:</span>
              <span className="ml-2 text-xl font-bold">Loosened</span>
            </div>
          </div>
        </div>
      </div>

      {/* Prerequisites Check */}
      {(tradeCards.length === 0 || wantCards.length === 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900">Setup Required for Enhanced Matching</h3>
              <p className="text-yellow-800 mb-4">
                Enhanced matching requires both cards to trade and cards you want for mutual benefit analysis:
              </p>
              <div className="space-y-2 text-sm text-yellow-800">
                {tradeCards.length === 0 && (
                  <div className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Add cards to your <strong>Trade List</strong> (cards you want to trade away)</span>
                  </div>
                )}
                {wantCards.length === 0 && (
                  <div className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Add cards to your <strong>Want List</strong> (cards you're looking for)</span>
                  </div>
                )}
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">💡 Quick Test Cards:</h4>
                <p className="text-sm text-blue-800">
                  Try adding popular cards like: <strong>Charizard, Pikachu, Blastoise, Venusaur, Mewtwo</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {matchingError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-2">Enhanced Matching Information</h3>
              <div className="text-red-800 whitespace-pre-line text-sm">{matchingError}</div>
            </div>
          </div>
        </div>
      )}

      {/* Matching Engine */}
      {showEngine && <MatchingEngine />}

      {/* Enhanced Features Info */}
      {matches.length > 0 && enhancedMatches.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center space-x-3 mb-4">
            <Brain className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-blue-900">Enhanced Matching Features (Testing Mode)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <h4 className="font-medium text-gray-900">Loosened Criteria</h4>
                <p className="text-sm text-gray-600">Max value diff: $1000, Min score: 10%</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <h4 className="font-medium text-gray-900">Mutual Benefit</h4>
                <p className="text-sm text-gray-600">Both users get what they want</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Award className="h-5 w-5 text-purple-600" />
              <div>
                <h4 className="font-medium text-gray-900">Value Tolerance</h4>
                <p className="text-sm text-gray-600">100% tolerance for testing</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {matches.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-900">Filter by Confidence:</span>
              </div>
              <select
                value={filterConfidence}
                onChange={(e) => setFilterConfidence(e.target.value as any)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Matches</option>
                <option value="high">High Confidence (85%+)</option>
                <option value="medium">Medium Confidence (70-84%)</option>
                <option value="low">Low Confidence (&lt;70%)</option>
              </select>
            </div>
            
            <div className="text-sm text-gray-600">
              Showing {filteredMatches.length} of {matches.length} matches
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Matches List */}
      <div className="space-y-4">
        {filteredMatches.map(match => {
          const otherUser = match.user1_id === user?.id ? match.user2 : match.user1;
          const myCard = match.user1_id === user?.id ? match.user1_card : match.user2_card;
          const theirCard = match.user1_id === user?.id ? match.user2_card : match.user1_card;
          const isEnhanced = 'mutual_benefit_score' in match;

          return (
            <div key={match.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-200">
              <div className="p-6">
                {/* Enhanced Match Badge */}
                {isEnhanced && (
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2 px-3 py-1 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full border border-blue-200">
                      <Brain className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Enhanced Match (Testing)</span>
                    </div>
                    {match.pricing_data && (
                      <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 rounded-full border border-green-200">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          {match.pricing_data.price_source === 'pokeprice' ? 'PokePrice Pricing' : 'Estimated'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <img
                      src={otherUser?.profile_image_url || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2'}
                      alt={otherUser?.username}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{otherUser?.username}</h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                          {otherUser?.total_trades || 0} trades
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">
                          {otherUser?.match_success_rate || 0}% success rate
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium border ${getMatchStrengthColor(match.match_score)}`}>
                      {getConfidenceIcon(match.match_score)}
                      <span>{getMatchStrengthLabel(match.match_score)}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Match Score</div>
                      <div className="text-2xl font-bold text-blue-600">{match.match_score}%</div>
                    </div>
                  </div>
                </div>

                {/* Cards Comparison */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Your Card */}
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center space-x-2">
                      <ArrowLeftRight className="h-4 w-4" />
                      <span>Your Card</span>
                    </h4>
                    {myCard && (
                      <div className="flex space-x-4">
                        <img
                          src={myCard.image_url || 'https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2'}
                          alt={myCard.name}
                          className="w-16 h-20 object-cover rounded-lg shadow-md"
                        />
                        <div className="flex-1">
                          <h5 className="font-bold text-gray-900">{myCard.name}</h5>
                          <p className="text-sm text-gray-600">#{myCard.card_number} • {myCard.set}</p>
                          <p className="text-sm text-gray-600">{myCard.condition}</p>
                          <div className="mt-1">
                            <p className="text-lg font-bold text-blue-600">
                              ${(match.pricing_data?.user1_card_price || parseFloat(myCard.market_price) || 0).toFixed(2)}
                            </p>
                            {match.pricing_data && match.pricing_data.price_source === 'pokeprice' && (
                              <p className="text-xs text-green-600">PokePrice Price</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Their Card */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                      <Target className="h-4 w-4" />
                      <span>Their Card</span>
                    </h4>
                    {theirCard && (
                      <div className="flex space-x-4">
                        <img
                          src={theirCard.image_url || 'https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2'}
                          alt={theirCard.name}
                          className="w-16 h-20 object-cover rounded-lg shadow-md"
                        />
                        <div className="flex-1">
                          <h5 className="font-bold text-gray-900">{theirCard.name}</h5>
                          <p className="text-sm text-gray-600">#{theirCard.card_number} • {theirCard.set}</p>
                          <p className="text-sm text-gray-600">{theirCard.condition}</p>
                          <div className="mt-1">
                            <p className="text-lg font-bold text-gray-600">
                              ${(match.pricing_data?.user2_card_price || parseFloat(theirCard.market_price) || 0).toFixed(2)}
                            </p>
                            {match.pricing_data && match.pricing_data.price_source === 'pokeprice' && (
                              <p className="text-xs text-green-600">PokePrice Price</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Enhanced Match Details */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
                  <div className="grid grid-cols-4 gap-6 flex-1">
                    <div className="text-center">
                      <div className="text-sm text-gray-600">Match Score</div>
                      <div className="text-lg font-bold text-blue-600">{match.match_score}/100</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600">Value Difference</div>
                      <div className="text-lg font-bold text-gray-600">${match.value_difference.toFixed(2)}</div>
                    </div>
                    {isEnhanced && (
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Mutual Benefit</div>
                        <div className={`text-lg font-bold ${getMutualBenefitColor(match.mutual_benefit_score || 0)}`}>
                          {match.mutual_benefit_score || 0}/100
                        </div>
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-sm text-gray-600">Trade Status</div>
                      <div className="text-lg font-bold text-green-600 capitalize">{match.status}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-6">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    <span className="text-sm text-gray-600">
                      {isEnhanced ? 'Enhanced AI' : 'AI Recommended'}
                    </span>
                  </div>
                </div>

                {/* Mutual Benefit Indicator */}
                {isEnhanced && match.mutual_benefit_score && match.mutual_benefit_score >= 50 && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-900">Mutually Beneficial Trade</span>
                    </div>
                    <p className="text-sm text-green-800 mt-1">
                      Both traders get cards they want within their value tolerance preferences.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <TradeProposalButton match={match} />
                  <button 
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <MessageCircle className="h-5 w-5" />
                    <span className="font-medium">Message</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredMatches.length === 0 && !loading && !matchingError && (
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <Zap className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {matches.length === 0 ? 'No enhanced matches found' : 'No matches for selected filter'}
          </h3>
          <p className="text-gray-600 mb-4">
            {matches.length === 0 
              ? 'Add cards to your trade and want lists, then generate enhanced matches'
              : 'Try adjusting your filter criteria to see more matches'
            }
          </p>
          {tradeCards.length > 0 && wantCards.length > 0 && (
            <button 
              onClick={handleGenerateMatches}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? 'Generating...' : 'Generate Enhanced Matches'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedMatches;