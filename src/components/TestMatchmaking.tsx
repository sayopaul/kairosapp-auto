import React, { useState } from 'react';
import { Play, RefreshCw, Users, Target, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PotentialMatch } from '../services/matchingService';

const TestMatchmaking: React.FC = () => {
  const [testResults, setTestResults] = useState<PotentialMatch[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [testUsers, setTestUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load real users from database
  React.useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, username')
          .order('username');
        
        if (error) throw error;
        setTestUsers(data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const runTest = async () => {
    if (!selectedUserId) return;

    setIsRunning(true);
    console.clear();
    console.log('🚀 Starting matchmaking test...');

    try {
      // Use real matching service instead of test service
      const { matchingService } = await import('../services/matchingService');
      const results = await matchingService.generateAndSaveMatches(selectedUserId);
      setTestResults(results);
      console.log('✅ Test completed successfully!');
    } catch (error) {
      console.error('❌ Test failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const resetTest = () => {
    setTestResults([]);
    setSelectedUserId('');
    console.log('🔄 Test data reset');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <Target className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Matchmaking Test Lab</h1>
            <p className="text-purple-100 text-lg">Test the matching algorithm with real data</p>
          </div>
        </div>
      </div>

      {/* Test Controls */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Test User
            </label>
            {loading ? (
              <div className="animate-pulse h-10 bg-gray-200 rounded-lg"></div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a user...</option>
                {testUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-end space-x-3">
            <button
              onClick={runTest}
              disabled={!selectedUserId || isRunning}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  <span>Run Test</span>
                </>
              )}
            </button>

            <button
              onClick={resetTest}
              className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              <RefreshCw className="h-5 w-5" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <span>Test Results ({testResults.length} matches found)</span>
          </h2>
          
          <div className="space-y-4">
            {testResults.map(match => (
              <div key={match.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    {match.user1?.username} ↔ {match.user2?.username}
                  </h3>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      match.confidence === 'high' 
                        ? 'bg-green-100 text-green-800' 
                        : match.confidence === 'medium'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {match.confidence} confidence
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      {match.match_score}%
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-1">Offering</h4>
                    <p className="text-blue-800">
                      {match.user1_card?.name} - {match.user1_card?.condition}
                    </p>
                    <p className="text-blue-600 font-semibold">
                      ${parseFloat(match.user1_card?.market_price).toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="bg-green-50 p-3 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-1">Receiving</h4>
                    <p className="text-green-800">
                      {match.user2_card?.name} - {match.user2_card?.condition}
                    </p>
                    <p className="text-green-600 font-semibold">
                      ${parseFloat(match.user2_card?.market_price).toFixed(2)}
                    </p>
                  </div>
                </div>
                
                <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
                  <span>Value Difference: ${match.value_difference.toFixed(2)}</span>
                  <span>
                    Value Score: {match.trade_score.valueScore.toFixed(0)}% | 
                    Condition Score: {match.trade_score.conditionScore.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-6 w-6 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">How to Use This Test</h3>
            <ol className="text-blue-800 space-y-1 text-sm">
              <li>1. Select a test user from the dropdown</li>
              <li>2. Click "Run Test" to execute the matching algorithm</li>
              <li>3. Check the browser console for detailed logs</li>
              <li>4. Review the results to see if matches are found correctly</li>
              <li>5. The system uses real database data for accurate testing</li>
            </ol>
            <p className="text-blue-700 mt-3 text-sm">
              <strong>Expected Result:</strong> Users with complementary trade/want cards should match with high scores
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestMatchmaking;