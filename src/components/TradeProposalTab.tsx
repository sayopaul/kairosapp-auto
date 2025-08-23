import React, { useEffect } from 'react';
import { ArrowLeftRight, Clock, Check, X, Truck, MapPin } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTradeProposals } from '../hooks/useTradeProposals';
import TradeProposalList from './TradeProposalList';
import { NavigationTab } from '../types';

interface TradeProposalTabProps {
  onTabChange?: (tab: NavigationTab) => void;
}

const TradeProposalTab: React.FC<TradeProposalTabProps> = ({ onTabChange }) => {
  
  const { user } = useAuth();
  const { proposals, loading } = useTradeProposals(user?.id);
  console.log('TradeProposalTab: Proposals data:', { 
    proposalsCount: proposals?.length || 0,
    loading,
    hasProposals: Boolean(proposals?.length)
  });

  // useEffect(() => {
  //   console.log('TradeProposalTab: Component mounted');
  //   return () => {
  //     console.log('TradeProposalTab: Component unmounted');
  //   };
  // }, []);

  useEffect(() => {
    console.log('TradeProposalTab: Proposals updated:', {
      count: proposals.length,
      loading
    });
  }, [proposals, loading]);
  
 
  
  if (!user) {
    console.log('TradeProposalTab: No user, showing login prompt');
    return (
      <div className="text-center py-12">
        <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
          <ArrowLeftRight className="h-10 w-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign in to view trade proposals</h3>
        <p className="text-gray-600">You need to be logged in to see your trade proposals</p>
      </div>
    );
  }
  
  console.log('TradeProposalTab: Rendering main content');
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 opacity-10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-2">
            <ArrowLeftRight className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Trade Proposals</h1>
          </div>
          <p className="text-gray-300 text-lg">Manage your active and past trade proposals</p>
        </div>
      </div>
      
      {/* Proposals List */}
      <TradeProposalList onTabChange={onTabChange} />
    </div>
  );
};

export default TradeProposalTab;