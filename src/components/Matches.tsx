import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  ArrowLeftRight,
  TrendingUp,
  Zap,
  Brain,
  Target,
  RefreshCw,
  Filter,
  AlertCircle,
  Plus,
  ToggleLeft,
  ToggleRight,
  Database,
  CheckCircle,
  X,
  Trash2,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useMatches } from "../hooks/useMatches";
import { useMatching } from "../hooks/useMatching";
import { useCards } from "../hooks/useCards";
import { useTradeProposals } from "../hooks/useTradeProposals";
import MatchingEngine from "./MatchingEngine";
import TestMatchmaking from "./TestMatchmaking";
import DebugPanel from "./DebugPanel";
import TradeProposalButton from "./TradeProposalButton";
import { NavigationTab } from "../types";
import { supabase } from "../lib/supabase";

interface MatchesProps {
  onTabChange?: (tab: NavigationTab) => void;
}

// Confirmation Modal Component
interface ConfirmDenyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  matchId: string;
  otherUser?: { username?: string };
  isProcessing?: boolean;
}

const ConfirmDenyModal: React.FC<ConfirmDenyModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  matchId,
  otherUser,
  isProcessing = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Deny Match</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-gray-700 mb-2">
              Are you sure you want to deny this match?
            </p>
            {otherUser?.username && (
              <p className="text-sm text-gray-600">
                This will remove the match with{" "}
                <strong>{otherUser.username}</strong> from your matches list.
              </p>
            )}
            <p className="text-sm text-gray-500 mt-2">
              This action cannot be undone.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Denying...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  <span>Deny Match</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Matches: React.FC<MatchesProps> = ({ onTabChange = () => {} }) => {
  const { user } = useAuth();
  const {
    matches: savedMatches,
    loading: savedLoading,
    refetchMatches,
  } = useMatches(user?.id);
  const {
    matches: generatedMatches,
    loading: generatedLoading,
    error: matchingError,
    generateMatches,
    progress: matchingProgress,
    status: matchingStatus,
  } = useMatching(user?.id);
  const { cards: tradeCards } = useCards(user?.id, "trade");
  const { cards: wantCards } = useCards(user?.id, "want");
  const { proposals } = useTradeProposals(user?.id);

  const [showEngine, setShowEngine] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [filterConfidence, setFilterConfidence] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [cardCache, setCardCache] = useState<{ [id: string]: any }>({});
  const [loadingCards, setLoadingCards] = useState<{ [id: string]: boolean }>(
    {}
  );
  const [useGeneratedMatches, setUseGeneratedMatches] = useState(false);
  const [enhancedPricing, setEnhancedPricing] = useState<{
    [cardId: string]: { price: number; source: string };
  }>({});

  // Confirmation modal state
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [matchToDeny, setMatchToDeny] = useState<{
    id: string;
    otherUser?: { username?: string };
  } | null>(null);
  const [isDenyingMatch, setIsDenyingMatch] = useState(false);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Automatically generate matches on mount if user is present
  useEffect(() => {
    if (user?.id) {
      generateMatches();
    }
  }, [user?.id, generateMatches]);

  const fetchCardDetails = async (id: string) => {
    if (cardCache[id] || loadingCards[id]) return;

    setLoadingCards((prev) => ({ ...prev, [id]: true }));

    try {
      const res = await fetch(`https://api.justtcg.com/v1/cards/${id}`);
      const data = await res.json();
      const card = data?.data;

      if (card && isMounted.current) {
        setCardCache((prev) => ({
          ...prev,
          [id]: {
            id: card.id,
            name: card.name,
            set: card.set?.name || "",
            rarity: card.rarity || "",
            market_price:
              card.cardmarket?.prices?.averageSellPrice ||
              card.tcgplayer?.prices?.normal?.market ||
              "N/A",
            image_url: card.images?.small || card.images?.large || "",
            card_number: card.number || "",
            condition: card.condition || "",
          },
        }));
      }
    } catch (e) {
      // Optionally handle error
    } finally {
      if (isMounted.current) {
        setLoadingCards((prev) => ({ ...prev, [id]: false }));
      }
    }
  };

  // Use generated matches if available and enabled, otherwise use saved matches
  const matches =
    useGeneratedMatches && generatedMatches.length > 0
      ? generatedMatches
      : savedMatches;
  const loading = useGeneratedMatches ? generatedLoading : savedLoading;

  const filteredMatches = matches.filter((match) => {
    if (filterConfidence === "all") return true;

    // Determine confidence based on match score
    let confidence: "high" | "medium" | "low" = "low";
    if (match.match_score >= 85) confidence = "high";
    else if (match.match_score >= 70) confidence = "medium";

    return confidence === filterConfidence;
  });

  const getMatchStrengthColor = (score: number) => {
    if (score >= 85) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 70) return "bg-blue-100 text-blue-800 border-blue-200";
    if (score >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const getMatchStrengthLabel = (score: number) => {
    if (score >= 85) return "Excellent Match";
    if (score >= 70) return "Good Match";
    if (score >= 60) return "Fair Match";
    return "Poor Match";
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 85) return <Target className="h-4 w-4" />;
    if (score >= 70) return <TrendingUp className="h-4 w-4" />;
    return <ArrowLeftRight className="h-4 w-4" />;
  };

  const handleGenerateMatches = () => {
    console.log("Manual match generation triggered");
    generateMatches();
    setUseGeneratedMatches(true);
  };

  const handleDenyMatch = (
    matchId: string,
    otherUser?: { username?: string }
  ) => {
    console.log("Deny match triggered for match:", matchId);
    setMatchToDeny({ id: matchId, otherUser });
    setShowDenyModal(true);
  };

  const confirmDenyMatch = async () => {
    if (!matchToDeny) return;

    try {
      setIsDenyingMatch(true);

      // Delete the match from the database
      const { error } = await supabase
        .from("matches")
        .delete()
        .eq("id", matchToDeny.id);

      if (error) {
        console.error("Error deleting match:", error);
        throw error;
      }

      console.log("Match deleted successfully:", matchToDeny.id);

      // Refresh matches list
      if (refetchMatches) {
        await refetchMatches();
      }

      // Close modal
      setShowDenyModal(false);
      setMatchToDeny(null);
    } catch (error) {
      console.error("Error denying match:", error);
      // You could add a toast notification here for error handling
    } finally {
      setIsDenyingMatch(false);
    }
  };

  const cancelDenyMatch = () => {
    setShowDenyModal(false);
    setMatchToDeny(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 mb-2">
            {matchingStatus || "Analyzing potential trades..."}
          </p>
          {matchingProgress > 0 && (
            <div className="w-64 mx-auto">
              <div className="bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${matchingProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {Math.round(matchingProgress)}% complete
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-4 md:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 opacity-10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <Zap className="h-8 w-8" />
                <h1 className="text-2xl md:text-3xl font-bold">
                  AI-Powered Matches
                </h1>
              </div>
              <p className="text-gray-300 text-base md:text-lg">
                Smart trading opportunities based on your collection
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3">
              <button
                onClick={() => setShowEngine(!showEngine)}
                className="flex items-center space-x-2 px-3 md:px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg hover:bg-white/20 transition-all duration-200 text-sm md:text-base"
              >
                <Brain className="h-5 w-5" />
                <span className="hidden sm:inline">Matching Engine</span>
                <span className="sm:hidden">Engine</span>
              </button>
              <button
                onClick={() => setShowTest(!showTest)}
                className="flex items-center space-x-2 px-3 md:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 text-sm md:text-base"
              >
                <Target className="h-5 w-5" />
                <span className="hidden sm:inline">Test Lab</span>
                <span className="sm:hidden">Test</span>
              </button>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="flex items-center space-x-2 px-3 md:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 text-sm md:text-base"
              >
                <Database className="h-5 w-5" />
                <span className="hidden sm:inline">Debug</span>
                <span className="sm:hidden">DB</span>
              </button>
              <button
                onClick={handleGenerateMatches}
                disabled={loading}
                className="flex items-center space-x-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm md:text-base"
              >
                <RefreshCw
                  className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">Generate Matches</span>
                <span className="sm:hidden">Generate</span>
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 md:flex md:items-center md:space-x-6 md:gap-0">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
              <span className="text-sm text-gray-300">Active Matches:</span>
              <span className="ml-2 text-xl font-bold">
                {filteredMatches.length}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
              <span className="text-sm text-gray-300">Trade Cards:</span>
              <span className="ml-2 text-xl font-bold">
                {tradeCards.length}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
              <span className="text-sm text-gray-300">Want Cards:</span>
              <span className="ml-2 text-xl font-bold">{wantCards.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      {showDebug && <DebugPanel />}

      {/* Test Lab */}
      {showTest && <TestMatchmaking />}

      {/* Match Mode Toggle */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 md:p-6 border border-blue-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3 md:space-x-4">
            <Brain className="h-6 w-6 text-blue-600" />
            <div>
              <h3 className="text-base md:text-lg font-semibold text-blue-900">
                Generated Matches
              </h3>
              <p className="text-sm md:text-base text-blue-700">
                AI-powered matching with advanced algorithms
              </p>
            </div>
          </div>
          <button
            onClick={() => setUseGeneratedMatches(!useGeneratedMatches)}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors duration-200 self-start md:self-auto"
          >
            {useGeneratedMatches ? (
              <ToggleRight className="h-8 w-8" />
            ) : (
              <ToggleLeft className="h-8 w-8" />
            )}
            <span className="font-medium">
              {useGeneratedMatches ? "Generated Mode" : "Saved Mode"}
            </span>
          </button>
        </div>
      </div>

      {/* Prerequisites Check */}
      {(tradeCards.length === 0 || wantCards.length === 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 md:p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-2">
                Setup Required for Matching
              </h3>
              <p className="text-yellow-800 mb-4">
                To find trading matches, you need both cards to trade and cards
                you want:
              </p>
              <div className="space-y-2 text-sm text-yellow-800">
                {tradeCards.length === 0 && (
                  <div className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>
                      Add cards to your <strong>Trade List</strong> (cards you
                      want to trade away)
                    </span>
                  </div>
                )}
                {wantCards.length === 0 && (
                  <div className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>
                      Add cards to your <strong>Want List</strong> (cards you're
                      looking for)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {matchingError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 md:p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-2">
                Matching Information
              </h3>
              <div className="text-red-800 whitespace-pre-line text-sm">
                {matchingError}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Matching Engine */}
      {showEngine && <MatchingEngine />}

      {/* Filters */}
      {matches.length > 0 && (
        <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-900">
                  Filter by Confidence:
                </span>
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
            <div className="text-sm text-gray-600 text-center md:text-right">
              Showing {filteredMatches.length} of {matches.length} matches
            </div>
          </div>
        </div>
      )}

      {/* Matches List */}
      {filteredMatches.length > 0 && (
        <div className="space-y-6">
          {filteredMatches.map((match) => {
            const isBundle =
              match.is_bundle ||
              match.user1_card_ids?.length > 1 ||
              match.user2_card_ids?.length > 1;

            // Robustly derive card IDs for both sides (handles single and bundle trades)
            const user1Ids = Array.isArray(match.user1_card_ids)
              ? match.user1_card_ids
              : [];
            const user2Ids = Array.isArray(match.user2_card_ids)
              ? match.user2_card_ids
              : [];

            // Always map over IDs and get card from all sources
            const getCard = (id: string, localArr: any[], matchArr: any[]) => {
              return (
                localArr.find((c: any) => c.id === id) ||
                matchArr.find((c: any) => c.id === id) ||
                cardCache[id] ||
                null
              );
            };

            // Determine if current user is user1 or user2, and assign my/their cards accordingly
            const currentUserId = user?.id;
            const matchUser1Id =
              (match as any).user1_id || (match as any).user1?.id;
            const matchUser2Id =
              (match as any).user2_id || (match as any).user2?.id;

            // Robustly determine which side is "yours" and which is "theirs" for this match
            let isCurrentUserUser1 = false;
            if (user && match) {
              if (match.user1_id && match.user1_id === user.id)
                isCurrentUserUser1 = true;
              else if (match.user2_id && match.user2_id === user.id)
                isCurrentUserUser1 = false;
              else if (match.user1 && match.user1.id === user.id)
                isCurrentUserUser1 = true;
              else if (match.user2 && match.user2.id === user.id)
                isCurrentUserUser1 = false;
              else if (match.user1_id === user?.id) isCurrentUserUser1 = true;
              else if (match.user2_id === user?.id) isCurrentUserUser1 = false;
            }

            // Swap ids and card arrays if current user is user2
            const myIds = isCurrentUserUser1 ? user1Ids : user2Ids;
            const theirIds = isCurrentUserUser1 ? user2Ids : user1Ids;

            // Use the correct card arrays for each user
            const user1Cards = Array.isArray((match as any).user1_cards)
              ? (match as any).user1_cards
              : [];
            const user2Cards = Array.isArray((match as any).user2_cards)
              ? (match as any).user2_cards
              : [];
            const myCardsArr = isCurrentUserUser1 ? user1Cards : user2Cards;
            const theirCardsArr = isCurrentUserUser1 ? user2Cards : user1Cards;

            // For single trades, use first card; for bundles, show all
            const myCard = !isBundle
              ? getCard(
                  myIds[0],
                  isCurrentUserUser1 ? tradeCards : wantCards,
                  myCardsArr
                )
              : null;
            const theirCard = !isBundle
              ? getCard(
                  theirIds[0],
                  isCurrentUserUser1 ? wantCards : tradeCards,
                  theirCardsArr
                )
              : null;

            // Define otherUser for profile display
            const otherUser = isCurrentUserUser1
              ? (match as any).user2 || null
              : (match as any).user1 || null;

            // Proposal-aware logic
            const existingProposal = proposals.find(
              (p) => p.match_id === match.id
            );

            return (
              <div
                key={match.id}
                className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-200"
              >
                <div className="p-4 md:p-6">
                  {/* Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center space-x-3">
                      <img
                        src={
                          otherUser?.profile_image_url ||
                          "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2"
                        }
                        alt={otherUser?.username}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover"
                      />
                      <div>
                        <h3 className="font-semibold text-gray-900 text-base md:text-lg">
                          {otherUser?.username || "Trader"}
                        </h3>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                          <span className="text-sm text-gray-600">
                            {otherUser?.total_trades || 0} trades
                          </span>
                          <span className="text-gray-400 hidden sm:inline">
                            •
                          </span>
                          <span className="text-sm text-gray-600">
                            {otherUser?.match_success_rate || 0}% success rate
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                      <div
                        className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium border ${getMatchStrengthColor(
                          match.match_score
                        )}`}
                      >
                        {getConfidenceIcon(match.match_score)}
                        <span>{getMatchStrengthLabel(match.match_score)}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Match Score</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {match.match_score}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cards Comparison */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
                    {/* Your Card(s) */}
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-3 flex items-center space-x-2">
                        <ArrowLeftRight className="h-4 w-4" />
                        <span>Your Card{myIds.length > 1 ? "s" : ""}</span>
                        {isBundle && (
                          <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full ml-2">
                            BUNDLE
                          </span>
                        )}
                      </h4>
                      {!isBundle && myCard && (
                        <div className="flex space-x-4">
                          <img
                            src={
                              myCard.image_url ||
                              "https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2"
                            }
                            alt={myCard.name}
                            className="w-12 h-16 md:w-16 md:h-20 object-cover rounded-lg shadow-md flex-shrink-0"
                          />
                          <div className="flex-1">
                            <h5 className="font-bold text-gray-900">
                              {myCard.name}
                            </h5>
                            <p className="text-sm text-gray-600">
                              #{myCard.card_number} • {myCard.set}
                            </p>
                            <p className="text-sm text-gray-600">
                              {myCard.condition}
                            </p>
                            <div className="mt-1">
                              <p className="text-lg font-bold text-blue-600">
                                $
                                {(
                                  enhancedPricing[myCard.id]?.price ||
                                  parseFloat(myCard.market_price || 0)
                                ).toFixed(2)}
                              </p>
                              {enhancedPricing[myCard.id] && (
                                <p className="text-xs text-green-600">
                                  {enhancedPricing[myCard.id].source}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {isBundle && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:flex md:flex-wrap gap-2 md:gap-3">
                          {myIds.length > 0 ? (
                            myIds.map((id: string) => {
                              const card = getCard(
                                id,
                                isCurrentUserUser1 ? tradeCards : wantCards,
                                myCardsArr
                              );
                              if (!card && loadingCards[id]) {
                                return (
                                  <div
                                    key={id}
                                    className="flex flex-col items-center w-16 md:w-20 animate-pulse"
                                  >
                                    <div className="w-12 h-16 md:w-16 md:h-20 bg-gray-200 rounded-lg shadow-md mb-1" />
                                    <span className="h-3 md:h-4 bg-gray-200 rounded w-12 md:w-16 mb-1" />
                                    <span className="h-2 md:h-3 bg-gray-100 rounded w-8 md:w-10" />
                                  </div>
                                );
                              }
                              if (!card)
                                return (
                                  <span
                                    key={id}
                                    className="text-sm text-gray-400"
                                  >
                                    Card unavailable
                                  </span>
                                );
                              return (
                                <div
                                  key={card.id}
                                  className="flex flex-col items-center w-16 md:w-20"
                                >
                                  <img
                                    src={
                                      card.image_url ||
                                      "https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2"
                                    }
                                    alt={card.name}
                                    className="w-12 h-16 md:w-16 md:h-20 object-cover rounded-lg shadow-md mb-1"
                                  />
                                  <span className="text-xs font-medium text-gray-900 text-center truncate w-full leading-tight">
                                    {card.name}
                                  </span>
                                  <span className="text-xs text-gray-500 mt-1">
                                    $
                                    {(
                                      enhancedPricing[card.id]?.price ||
                                      parseFloat(card.market_price || 0)
                                    ).toFixed(2)}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-sm text-gray-400">
                              Card details unavailable
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Their Card(s) */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                        <Target className="h-4 w-4" />
                        <span>Their Card{theirIds.length > 1 ? "s" : ""}</span>
                        {isBundle && (
                          <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full ml-2">
                            BUNDLE
                          </span>
                        )}
                      </h4>
                      {!isBundle && theirCard && (
                        <div className="flex space-x-4">
                          <img
                            src={
                              theirCard.image_url ||
                              "https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2"
                            }
                            alt={theirCard.name}
                            className="w-12 h-16 md:w-16 md:h-20 object-cover rounded-lg shadow-md flex-shrink-0"
                          />
                          <div className="flex-1">
                            <h5 className="font-bold text-gray-900">
                              {theirCard.name}
                            </h5>
                            <p className="text-sm text-gray-600">
                              #{theirCard.card_number} • {theirCard.set}
                            </p>
                            <p className="text-sm text-gray-600">
                              {theirCard.condition}
                            </p>
                            <div className="mt-1">
                              <p className="text-lg font-bold text-gray-600">
                                $
                                {(
                                  enhancedPricing[theirCard.id]?.price ||
                                  parseFloat(theirCard.market_price || 0)
                                ).toFixed(2)}
                              </p>
                              {enhancedPricing[theirCard.id] && (
                                <p className="text-xs text-green-600">
                                  {enhancedPricing[theirCard.id].source}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {isBundle && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:flex md:flex-wrap gap-2 md:gap-3">
                          {theirIds.length > 0 ? (
                            theirIds.map((id: string) => {
                              const card = getCard(
                                id,
                                isCurrentUserUser1 ? wantCards : tradeCards,
                                theirCardsArr
                              );
                              if (!card && loadingCards[id]) {
                                return (
                                  <div
                                    key={id}
                                    className="flex flex-col items-center w-16 md:w-20 animate-pulse"
                                  >
                                    <div className="w-12 h-16 md:w-16 md:h-20 bg-gray-200 rounded-lg shadow-md mb-1" />
                                    <span className="h-3 md:h-4 bg-gray-200 rounded w-12 md:w-16 mb-1" />
                                    <span className="h-2 md:h-3 bg-gray-100 rounded w-8 md:w-10" />
                                  </div>
                                );
                              }
                              if (!card)
                                return (
                                  <span
                                    key={id}
                                    className="text-sm text-gray-400"
                                  >
                                    Card unavailable
                                  </span>
                                );
                              return (
                                <div
                                  key={card.id}
                                  className="flex flex-col items-center w-16 md:w-20"
                                >
                                  <img
                                    src={
                                      card.image_url ||
                                      "https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2"
                                    }
                                    alt={card.name}
                                    className="w-12 h-16 md:w-16 md:h-20 object-cover rounded-lg shadow-md mb-1"
                                  />
                                  <span className="text-xs font-medium text-gray-900 text-center truncate w-full leading-tight">
                                    {card.name}
                                  </span>
                                  <span className="text-xs text-gray-500 mt-1">
                                    $
                                    {(
                                      enhancedPricing[card.id]?.price ||
                                      parseFloat(card.market_price || 0)
                                    ).toFixed(2)}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-sm text-gray-400">
                              Card details unavailable
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Match Details */}
                  <div className="p-4 bg-gray-50 rounded-lg mb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Match Score</div>
                        <div className="text-lg font-bold text-blue-600">
                          {match.match_score}/100
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-600">
                          Value Difference
                        </div>
                        <div className="text-lg font-bold text-gray-600">
                          ${Math.abs(match.value_difference).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-600">
                          Trade Status
                        </div>
                        <div className="text-lg font-bold text-green-600 capitalize">
                          {match.status || "pending"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center space-x-2 mt-3 md:mt-0 md:absolute md:top-4 md:right-4">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                      <span className="text-sm text-gray-600">
                        AI Recommended
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons (proposal-aware) */}
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 mt-4">
                    {existingProposal ? (
                      <button
                        type="button"
                        onClick={() => onTabChange("proposals")}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl text-sm md:text-base"
                      >
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">
                          {existingProposal?.status === "proposed" &&
                          existingProposal.recipient_id === user?.id
                            ? "Review Proposal"
                            : existingProposal?.status ===
                                "accepted_by_recipient" &&
                              existingProposal.proposer_id === user?.id
                            ? "Confirm Trade"
                            : existingProposal?.status === "confirmed"
                            ? "Select Shipping"
                            : "View Trade Status"}
                        </span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.hash = "#chat";
                          }}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl text-sm md:text-base"
                        >
                          <MessageCircle className="h-5 w-5" />
                          <span className="font-medium">
                            <span className="hidden sm:inline">
                              Start Conversation
                            </span>
                            <span className="sm:hidden">Chat</span>
                          </span>
                        </button>
                        <TradeProposalButton match={match} />
                        {/* Add a new button to deny match */}
                        <button
                          onClick={() => handleDenyMatch(match.id, otherUser)}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 shadow-lg hover:shadow-xl text-sm md:text-base"
                        >
                          <X className="h-5 w-5" />
                          <span className="font-medium">Deny Match</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {filteredMatches.length === 0 && !loading && !matchingError && (
        <div className="text-center py-8 md:py-12 px-4">
          <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <Zap className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">
            {matches.length === 0
              ? "No matches found"
              : "No matches for selected filter"}
          </h3>
          <p className="text-sm md:text-base text-gray-600 mb-4">
            {matches.length === 0
              ? "Add cards to your trade and want lists, then generate matches"
              : "Try adjusting your filter criteria to see more matches"}
          </p>
          {tradeCards.length > 0 && wantCards.length > 0 && (
            <button
              onClick={handleGenerateMatches}
              disabled={loading}
              className="px-4 md:px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm md:text-base"
            >
              {loading ? "Generating..." : "Generate Matches"}
            </button>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmDenyModal
        isOpen={showDenyModal}
        onClose={cancelDenyMatch}
        onConfirm={confirmDenyMatch}
        matchId={matchToDeny?.id || ""}
        otherUser={matchToDeny?.otherUser}
        isProcessing={isDenyingMatch}
      />
    </div>
  );
};

export default Matches;