import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Database, Shield, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { DebugService } from '../services/debugService';

const DebugPanel: React.FC = () => {
  const { user } = useAuth();
  const [debugReport, setDebugReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDebugTests = async () => {
    setLoading(true);
    try {
      const report = await DebugService.generateDebugReport(user?.id);
      setDebugReport(report);
    } catch (error) {
      console.error('Debug test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return status ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getStatusColor = (status: boolean | null) => {
    if (status === null) return 'border-yellow-200 bg-yellow-50';
    return status ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-8 text-white">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <Database className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Database Debug Panel</h1>
            <p className="text-orange-100 text-lg">Diagnose Supabase table update issues</p>
          </div>
        </div>
      </div>

      {/* Debug Controls */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Database Diagnostics</h2>
          <button
            onClick={runDebugTests}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Running Tests...</span>
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" />
                <span>Run Debug Tests</span>
              </>
            )}
          </button>
        </div>

        {!user && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="font-medium text-yellow-900">Authentication Required</h3>
                <p className="text-yellow-800 text-sm">Please sign in to run comprehensive database tests</p>
              </div>
            </div>
          </div>
        )}

        {debugReport && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
            
            {/* Connection Test */}
            <div className={`p-4 rounded-lg border ${getStatusColor(debugReport.connection?.connection)}`}>
              <div className="flex items-center space-x-3 mb-2">
                {getStatusIcon(debugReport.connection?.connection)}
                <h4 className="font-medium text-gray-900">Database Connection</h4>
              </div>
              {debugReport.connection?.connection ? (
                <div className="text-sm text-gray-700">
                  <p>✅ Successfully connected to Supabase</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>Users table: {debugReport.connection.users ? '✅' : '❌'}</div>
                    <div>Cards table: {debugReport.connection.cards ? '✅' : '❌'}</div>
                    <div>Matches table: {debugReport.connection.matches ? '✅' : '❌'}</div>
                    <div>Transactions table: {debugReport.connection.transactions ? '✅' : '❌'}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-red-700">❌ Database connection failed</p>
              )}
            </div>

            {/* RLS Test */}
            <div className={`p-4 rounded-lg border ${getStatusColor(debugReport.rls)}`}>
              <div className="flex items-center space-x-3 mb-2">
                {getStatusIcon(debugReport.rls)}
                <h4 className="font-medium text-gray-900">Row Level Security (RLS)</h4>
              </div>
              <p className="text-sm text-gray-700">
                {debugReport.rls 
                  ? '✅ RLS policies are working correctly' 
                  : '❌ RLS policies may be blocking operations'
                }
              </p>
            </div>

            {/* Match Insert Test */}
            {debugReport.matchInsert !== null && (
              <div className={`p-4 rounded-lg border ${getStatusColor(debugReport.matchInsert)}`}>
                <div className="flex items-center space-x-3 mb-2">
                  {getStatusIcon(debugReport.matchInsert)}
                  <h4 className="font-medium text-gray-900">Matches Table Insert</h4>
                </div>
                <p className="text-sm text-gray-700">
                  {debugReport.matchInsert 
                    ? '✅ Can successfully insert into matches table' 
                    : '❌ Failed to insert into matches table'
                  }
                </p>
              </div>
            )}

            {/* Transaction Insert Test */}
            {debugReport.transactionInsert !== null && (
              <div className={`p-4 rounded-lg border ${getStatusColor(debugReport.transactionInsert)}`}>
                <div className="flex items-center space-x-3 mb-2">
                  {getStatusIcon(debugReport.transactionInsert)}
                  <h4 className="font-medium text-gray-900">Transactions Table Insert</h4>
                </div>
                <p className="text-sm text-gray-700">
                  {debugReport.transactionInsert 
                    ? '✅ Can successfully insert into transactions table' 
                    : '❌ Failed to insert into transactions table'
                  }
                </p>
              </div>
            )}

            {/* Recommendations */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Recommendations</h4>
              <div className="text-sm text-blue-800 space-y-1">
                {!debugReport.connection?.connection && (
                  <p>• Check your Supabase connection settings and API keys</p>
                )}
                {!debugReport.connection?.matches && (
                  <p>• Verify matches table exists and has correct schema</p>
                )}
                {!debugReport.connection?.transactions && (
                  <p>• Verify transactions table exists and has correct schema</p>
                )}
                {!debugReport.rls && (
                  <p>• Check RLS policies - they may be too restrictive</p>
                )}
                {debugReport.matchInsert === false && (
                  <p>• Check foreign key constraints and data validation rules</p>
                )}
                {debugReport.transactionInsert === false && (
                  <p>• Verify transaction table structure and constraints</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Common Issues */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Common Issues & Solutions</h2>
        
        <div className="space-y-4">
          <div className="border-l-4 border-red-500 pl-4">
            <h3 className="font-medium text-red-900">Tables not updating</h3>
            <p className="text-sm text-red-800">Usually caused by RLS policies blocking operations or missing foreign key relationships</p>
          </div>
          
          <div className="border-l-4 border-yellow-500 pl-4">
            <h3 className="font-medium text-yellow-900">Insert operations failing</h3>
            <p className="text-sm text-yellow-800">Check for constraint violations, missing required fields, or invalid foreign keys</p>
          </div>
          
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-medium text-blue-900">Authentication issues</h3>
            <p className="text-sm text-blue-800">Ensure user is properly authenticated and RLS policies allow the operation</p>
          </div>
          
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="font-medium text-green-900">Schema mismatches</h3>
            <p className="text-sm text-green-800">Verify table structure matches your TypeScript types and migration files</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel;