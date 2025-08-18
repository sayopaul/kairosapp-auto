import React, { useState } from 'react';
import { Zap, Settings, TrendingUp, Target, Brain, Sparkles, RefreshCw, AlertCircle, Crown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useMatching } from '../hooks/useMatching';
import { useUserProfile } from '../hooks/useUserProfile';
import { useSubscriptionLimits } from '../hooks/useSubscriptionLimits';

const MatchingEngine: React.FC = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id);
  const { matches, loading, error, generateMatches, refreshMatches } = useMatching(user?.id);
  const { canUseFeature, currentTier } = useSubscriptionLimits(user?.id);
  const [matchingMode, setMatchingMode] = useState<'basic' | 'advanced'>('basic');
  const [showSettings, setShowSettings] = useState(false);

  const handleGenerateMatches = async () => {
    const advancedCheck = canUseFeature('canUseAdvancedMatching');
    
    if (matchingMode === 'advanced' && !advancedCheck.allowed) {
      return; // Don't proceed if advanced matching is not allowed
    }
    
    await generateMatches(matchingMode === 'advanced');
  };

  const getMatchingDescription = () => {
    if (matchingMode === 'advanced') {
      return "AI-powered matching with machine learning algorithms, considering trading history, market trends, and user behavior patterns.";
    }
    return "Smart matching based on card values, conditions, and user preferences with comprehensive scoring.";
  };

  const advancedMatchingCheck = canUseFeature('canUseAdvancedMatching');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Brain className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">AI Matching Engine</h1>
              <p className="text-blue-100 text-lg">Intelligent trade discovery powered by advanced algorithms</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="flex items-center space-x-2 mb-2">
                <Target className="h-5 w-5" />
                <span className="font-semibold">Precision Matching</span>
              </div>
              <p className="text-sm text-blue-100">Multi-factor analysis for optimal trade suggestions</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="h-5 w-5" />
                <span className="font-semibold">Market Intelligence</span>
              </div>
              <p className="text-sm text-blue-100">Real-time pricing and demand analysis</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="flex items-center space-x-2 mb-2">
                <Sparkles className="h-5 w-5" />
                <span className="font-semibold">Smart Recommendations</span>
              </div>
              <p className="text-sm text-blue-100">Personalized based on your trading history</p>
            </div>
          </div>
        </div>
      </div>

      {/* Matching Controls */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Matching Configuration</h2>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {/* Matching Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div
            onClick={() => setMatchingMode('basic')}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
              matchingMode === 'basic'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-3 mb-2">
              <Zap className={`h-6 w-6 ${matchingMode === 'basic' ? 'text-blue-600' : 'text-gray-600'}`} />
              <h3 className={`font-semibold ${matchingMode === 'basic' ? 'text-blue-900' : 'text-gray-900'}`}>
                Smart Matching
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Comprehensive algorithm considering value, condition, rarity, and user reputation
            </p>
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Free</span>
              <span className="text-xs text-gray-500">Available to all users</span>
            </div>
          </div>

          <div
            onClick={() => !advancedMatchingCheck.allowed ? null : setMatchingMode('advanced')}
            className={`p-4 rounded-lg border-2 transition-all duration-200 ${
              !advancedMatchingCheck.allowed
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-75'
                : matchingMode === 'advanced'
                  ? 'border-purple-500 bg-purple-50 cursor-pointer'
                  : 'border-gray-200 hover:border-gray-300 cursor-pointer'
            }`}
          >
            <div className="flex items-center space-x-3 mb-2">
              <Brain className={`h-6 w-6 ${
                matchingMode === 'advanced' && advancedMatchingCheck.allowed 
                  ? 'text-purple-600' 
                  : 'text-gray-600'
              }`} />
              <h3 className={`font-semibold ${
                matchingMode === 'advanced' && advancedMatchingCheck.allowed 
                  ? 'text-purple-900' 
                  : 'text-gray-900'
              }`}>
                AI-Powered Matching
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Machine learning algorithms with behavioral analysis and predictive modeling
            </p>
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">Premium</span>
              <span className="text-xs text-gray-500">Elite Trainer+</span>
            </div>
            {!advancedMatchingCheck.allowed && (
              <div className="mt-2 text-xs text-orange-600">
                Upgrade required for advanced matching
              </div>
            )}
          </div>
        </div>

        {/* Current Settings Display */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 mb-2">Current Configuration</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Mode:</span>
              <span className="ml-2 font-medium text-gray-900 capitalize">{matchingMode}</span>
            </div>
            <div>
              <span className="text-gray-600">Value Tolerance:</span>
              <span className="ml-2 font-medium text-gray-900">{profile?.trade_percentage_min || 80}%</span>
            </div>
            <div>
              <span className="text-gray-600">Min Score:</span>
              <span className="ml-2 font-medium text-gray-900">
                {matchingMode === 'advanced' ? '75' : '60'}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">{getMatchingDescription()}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={handleGenerateMatches}
            disabled={loading || (matchingMode === 'advanced' && !advancedMatchingCheck.allowed)}
            className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Analyzing Matches...</span>
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" />
                <span>Generate Matches</span>
              </>
            )}
          </button>
          
          <button
            onClick={refreshMatches}
            disabled={loading}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        {/* Subscription Requirement Notice */}
        {!advancedMatchingCheck.allowed && (
          <div className="mt-4 flex items-start space-x-3 p-4 rounded-lg border bg-orange-50 border-orange-200">
            <Crown className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-orange-900">{advancedMatchingCheck.message}</h4>
              <p className="text-sm text-orange-800 mt-1">
                Upgrade to unlock advanced AI matching with machine learning capabilities.
              </p>
              <p className="text-xs text-orange-700 mt-2">
                Current tier: <strong>{currentTier === 'trainer' ? 'Free' : currentTier === 'elite' ? 'Elite Trainer' : 'Master Collector'}</strong>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <h4 className="font-medium text-red-900">Matching Error</h4>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {matches.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Matching Results</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{matches.length}</div>
              <div className="text-sm text-gray-600">Total Matches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {matches.filter(m => m.confidence === 'high').length}
              </div>
              <div className="text-sm text-gray-600">High Confidence</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {matches.length > 0 ? Math.round(matches.reduce((sum, m) => sum + m.match_score, 0) / matches.length) : 0}
              </div>
              <div className="text-sm text-gray-600">Avg Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                ${matches.length > 0 ? Math.round(matches.reduce((sum, m) => sum + m.value_difference, 0) / matches.length) : 0}
              </div>
              <div className="text-sm text-gray-600">Avg Value Diff</div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Found {matches.length} potential trades using {matchingMode} matching algorithm
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchingEngine;