import React, { useState, useEffect } from "react";
import {
  ArrowLeftRight,
  Check,
  X,
  Clock,
  Truck,
  MapPin,
  Filter,
  Search,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useTradeProposals } from "../hooks/useTradeProposals";
import { TradeProposal, NavigationTab } from "../types";
import TradeProposalModal from "./TradeProposalModal";

export const TradeProposalList: React.FC<{
  onTabChange?: (tab: NavigationTab) => void;
}> = ({ onTabChange }) => {
  console.log("TradeProposalList: Component rendering");

  const { user } = useAuth();
  const { proposals, loading, error, refetchProposals } = useTradeProposals(
    user?.id
  );

  useEffect(() => {
    console.log("TradeProposalList: Component mounted");
    return () => {
      console.log("TradeProposalList: Component unmounted");
    };
  }, []);

  useEffect(() => {
    console.log("TradeProposalList: Proposals data changed:", {
      proposalsCount: proposals.length,
      loading,
      error,
    });

    // Debug each proposal
    proposals.forEach((proposal, index) => {
      console.log(`📋 Proposal ${index + 1}:`, {
        id: proposal.id,
        status: proposal.status,
        hasMatch: !!proposal.match,
        matchId: proposal.match_id,
        match: proposal.match,
      });
    });
  }, [proposals, loading, error]);

  const [selectedProposal, setSelectedProposal] =
    useState<TradeProposal | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const stats = [
    {
      label: "Total",
      value: proposals.length,
      icon: ArrowLeftRight,
      color: "bg-blue-100 text-blue-600",
    },
    {
      label: "Pending",
      value: proposals.filter((p) => p.status === "proposed").length,
      icon: Clock,
      color: "bg-yellow-100 text-yellow-600",
    },
    {
      label: "Accepted",
      value: proposals.filter((p) => p.status === "accepted_by_recipient")
        .length,
      icon: Check,
      color: "bg-green-100 text-green-600",
    },
    {
      label: "In Progress",
      value: proposals.filter(
        (p) => p.status === "confirmed" || p.status === "shipping_pending"
      ).length,
      icon: RefreshCw,
      color: "bg-purple-100 text-purple-600",
    },
    {
      label: "Completed",
      value: proposals.filter((p) => p.status === "completed").length,
      icon: CheckCircle,
      color: "bg-green-100 text-green-600",
    },
    {
      label: "Declined",
      value: proposals.filter(
        (p) => p.status === "declined" || p.status === "cancelled"
      ).length,
      icon: X,
      color: "bg-red-100 text-red-600",
    },
  ];

  const getLatestStatus = (proposal: TradeProposal): string => {
    if (proposal.status === "proposed") {
      if (proposal.proposer_confirmed && proposal.recipient_confirmed) {
        return "confirmed";
      } else if (proposal.proposer_confirmed || proposal.recipient_confirmed) {
        return "accepted_by_recipient";
      } else {
        return "proposed";
      }
    } else if (proposal.status === "shipping_pending") {
      return "shipping_pending";
    } else if (proposal.status === "shipping_confirmed") {
      if (
        proposal.proposer_shipping_confirmed &&
        proposal.recipient_shipping_confirmed
      ) {
        return "completed";
      } else {
        return "shipping_pending";
      }
    }
    return proposal.status;
  };

  const filteredProposals = proposals.filter((proposal) => {
    const actualStatus = getLatestStatus(proposal);

    // Only show active, pending proposals - exclude completed, declined, and cancelled
    if (["completed", "declined", "cancelled"].includes(actualStatus)) {
      return false;
    }

    // Additional safety check - filter out proposals with missing card data
    // (These should already be deleted by the hook, but this is a safety net)
    const match = proposal.match;
    if (!match) {
      console.warn(
        "🚨 Found proposal with no match data (should have been deleted):",
        proposal.id
      );
      return false;
    }

    // Check if this is a bundle trade
    const isBundle =
      match.is_bundle ||
      (Array.isArray(match.user1_card_ids) &&
        match.user1_card_ids.length > 1) ||
      (Array.isArray(match.user2_card_ids) && match.user2_card_ids.length > 1);

    if (!isBundle) {
      // For single trades, check if we have the required card data
      const hasUser1Card =
        match.user1_card || (match.user1_cards && match.user1_cards.length > 0);
      const hasUser2Card =
        match.user2_card || (match.user2_cards && match.user2_cards.length > 0);

      if (!hasUser1Card || !hasUser2Card) {
        console.warn(
          "🚨 Found proposal with missing single trade card data (should have been deleted):",
          proposal.id
        );
        return false;
      }
    } else {
      // For bundle trades, check if we have card arrays with data
      const hasUser1Cards = match.user1_cards && match.user1_cards.length > 0;
      const hasUser2Cards = match.user2_cards && match.user2_cards.length > 0;

      if (!hasUser1Cards || !hasUser2Cards) {
        console.warn(
          "🚨 Found proposal with missing bundle card data (should have been deleted):",
          proposal.id
        );
        return false;
      }
    }

    if (statusFilter !== "all" && actualStatus !== statusFilter) {
      return false;
    }

    if (searchTerm) {
      const matchCard = proposal.match;
      const cardNames = [
        matchCard?.user1_card?.name,
        matchCard?.user2_card?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!cardNames.includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  console.log("🔍 Filtered proposals:", {
    total: proposals.length,
    filtered: filteredProposals.length,
    statusFilter,
    searchTerm,
  });
  const handleProposalClick = (proposal: TradeProposal) => {
    console.log("Clicked proposal:", proposal);
    setSelectedProposal(proposal);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    refetchProposals();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "proposed":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "accepted_by_recipient":
        return <Check className="h-5 w-5 text-blue-600" />;
      case "confirmed":
        return <Check className="h-5 w-5 text-green-600" />;
      case "shipping_pending":
        return <Truck className="h-5 w-5 text-blue-600" />;
      case "shipping_confirmed":
      case "completed":
        return <Check className="h-5 w-5 text-green-600" />;
      case "declined":
      case "cancelled":
        return <X className="h-5 w-5 text-red-600" />;
      default:
        return <ArrowLeftRight className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "proposed":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "accepted_by_recipient":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200";
      case "shipping_pending":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "shipping_confirmed":
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "declined":
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const renderCardDetails = (card: any) => {
    if (!card) {
      return (
        <div className="text-center text-gray-500 text-sm">
          Card details unavailable
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-3">
        <img
          src={
            card.image_url ||
            "https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2"
          }
          alt={card.name || "Card"}
          className="w-12 h-16 object-cover rounded-lg shadow-md"
        />
        <div>
          <h5 className="font-semibold text-gray-900">
            {card.name || "Unknown Card"}
          </h5>
          <p className="text-sm text-gray-600">
            {card.card_number ? `#${card.card_number}` : ""}
            {card.set ? ` • ${card.set}` : ""}
          </p>
          <p className="text-sm font-bold text-blue-600">
            $
            {card.market_price
              ? parseFloat(card.market_price).toFixed(2)
              : "0.00"}
          </p>
        </div>
      </div>
    );
  };

  const renderBundleCards = (cards: any[]) => {
    if (!cards || cards.length === 0) {
      return (
        <div className="text-center text-gray-500 text-sm">
          Bundle details unavailable
        </div>
      );
    }

    const totalValue = cards.reduce(
      (sum, card) => sum + (parseFloat(card.market_price) || 0),
      0
    );

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {cards.slice(0, 3).map((card, index) => (
            <div
              key={card.id || index}
              className="flex flex-col items-center w-16"
            >
              <img
                src={
                  card.image_url ||
                  "https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2"
                }
                alt={card.name || "Card"}
                className="w-12 h-16 object-cover rounded-lg shadow-md mb-1"
              />
              <span className="text-xs font-medium text-gray-900 text-center truncate w-full">
                {card.name || "Unknown"}
              </span>
            </div>
          ))}
          {cards.length > 3 && (
            <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg">
              <span className="text-xs text-gray-600">+{cards.length - 3}</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <span className="text-sm text-gray-600">Total:</span>
          <span className="ml-1 font-bold text-blue-600">
            ${totalValue.toFixed(2)}
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Loader2 className="h-32 w-32 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading trade proposals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <X className="h-6 w-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">
              Error Loading Proposals
            </h3>
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, index) => {
          console.log("TradeProposalTab: Rendering stat:", {
            label: stat.label,
            value: stat.value,
          });
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl p-4 shadow-lg border border-gray-100"
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="font-medium text-gray-900">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>
      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by card name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Proposals</option>
              <option value="proposed">Pending</option>
              <option value="accepted_by_recipient">Accepted</option>
              <option value="confirmed">Confirmed</option>
              <option value="shipping_pending">Shipping</option>
              <option value="completed">Completed</option>
              <option value="declined">Declined</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Debug Information</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>Total proposals: {proposals.length}</p>
          <p>Filtered proposals: {filteredProposals.length}</p>
          <p>Current filter: {statusFilter}</p>
          <p>Search term: "{searchTerm}"</p>
        </div>
      </div>

      {/* Proposals List */}
      {filteredProposals.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <ArrowLeftRight className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {proposals.length === 0
              ? "No trade proposals yet"
              : "No proposals match your filters"}
          </h3>
          <p className="text-gray-600">
            {proposals.length === 0
              ? "Start trading to see proposals here"
              : "Try adjusting your search or filter criteria"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((proposal) => {
            const actualStatus = getLatestStatus(proposal);
            const match = proposal.match;
            console.log("proposal", proposal);

            console.log("🎯 Rendering proposal:", {
              id: proposal.id,
              status: actualStatus,
              hasMatch: !!match,
              matchData: match,
              user1: match?.user1,
              user2: match?.user2,
            });

            // Skip proposals with invalid match data
            if (!match || !match.user1_id || !match.user2_id) {
              console.warn(
                "Skipping proposal with invalid match data:",
                proposal.id
              );
              return null;
            }

            // Determine if current user is proposer or recipient
            const isProposer = proposal.proposer_id === user?.id;
            const isRecipient = proposal.recipient_id === user?.id;

            // Get other user info with fallbacks
            const otherUser = isProposer ? match?.user2 : match?.user1;
            const otherUsername = otherUser?.username || "Unknown User";

            // Determine if this is a bundle trade
            const isBundle =
              match?.is_bundle ||
              (Array.isArray(match?.user1_card_ids) &&
                match.user1_card_ids.length > 1) ||
              (Array.isArray(match?.user2_card_ids) &&
                match.user2_card_ids.length > 1);

            // Get cards with fallbacks
            const myCards = isProposer
              ? match?.user1_cards
              : match?.user2_cards;
            const theirCards = isProposer
              ? match?.user2_cards
              : match?.user1_cards;
            const myCard = myCards?.[0];
            const theirCard = theirCards?.[0];

            return (
              <div
                key={proposal.id}
                onClick={() => handleProposalClick(proposal)}
                className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-200 cursor-pointer"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <img
                        src={
                          otherUser?.profile_image_url ||
                          "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2"
                        }
                        alt={otherUsername}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {otherUsername}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {isProposer ? "You proposed to" : "Proposed by"}{" "}
                          {otherUsername}
                        </p>
                      </div>
                    </div>

                    <div>{proposal.id}</div>

                    <div className="flex items-center space-x-3">
                      {isBundle && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                          BUNDLE
                        </span>
                      )}
                      <div
                        className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                          actualStatus
                        )}`}
                      >
                        {getStatusIcon(actualStatus)}
                        <span>{formatStatus(actualStatus)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Trade Details */}
                  {match ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Your Cards */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h4 className="font-semibold text-blue-900 mb-2">
                          Your {isBundle ? "Cards" : "Card"}
                        </h4>
                        {isBundle
                          ? renderBundleCards(myCards || [])
                          : renderCardDetails(myCard)}
                      </div>

                      {/* Their Cards */}
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          Their {isBundle ? "Cards" : "Card"}
                        </h4>
                        {isBundle
                          ? renderBundleCards(theirCards || [])
                          : renderCardDetails(theirCard)}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-5 w-5 text-yellow-600" />
                        <div>
                          <h4 className="font-medium text-yellow-900">
                            Match Data Loading
                          </h4>
                          <p className="text-sm text-yellow-800">
                            Trade details are being loaded. Match ID:{" "}
                            {proposal.match_id}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                    <span>
                      Created:{" "}
                      {new Date(proposal.created_at).toLocaleDateString()}
                    </span>
                    {proposal.updated_at && (
                      <span>
                        Updated:{" "}
                        {new Date(proposal.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Trade Proposal Modal */}
      <TradeProposalModal
        isOpen={showModal && !!selectedProposal}
        onClose={handleModalClose}
        matchId={selectedProposal?.match_id || ""}
        matchScore={selectedProposal?.match?.match_score || 0}
        user1={{
          id: selectedProposal?.match?.user1_id || "",
          username: selectedProposal?.match?.user1?.username || "Unknown",
          profile_image_url: selectedProposal?.match?.user1?.profile_image_url,
          email: selectedProposal?.match?.user1?.email,
        }}
        user2={{
          id: selectedProposal?.match?.user2_id || "",
          username: selectedProposal?.match?.user2?.username || "Unknown",
          profile_image_url: selectedProposal?.match?.user2?.profile_image_url,
          email: selectedProposal?.match?.user2?.email,
        }}
        user1Card={selectedProposal?.match?.user1_cards?.[0]}
        user2Card={selectedProposal?.match?.user2_cards?.[0]}
        isBundle={selectedProposal?.match?.is_bundle}
        user1Cards={selectedProposal?.match?.user1_cards}
        user2Cards={selectedProposal?.match?.user2_cards}
        onTabChange={onTabChange}
      />

      {/* {showModal && (
        <TradeProposalModal
          isOpen={showModal && !!selectedProposal}
          onClose={handleModalClose}
          matchId={selectedProposal?.match_id || ""}
          matchScore={selectedProposal?.match?.match_score || 0}
          user1={{
            id: selectedProposal?.match?.user1_id || "",
            username: selectedProposal?.match?.user1?.username || "Unknown",
            profile_image_url:
              selectedProposal?.match?.user1?.profile_image_url,
            email: selectedProposal?.match?.user1?.email,
          }}
          user2={{
            id: selectedProposal?.match?.user2_id || "",
            username: selectedProposal?.match?.user2?.username || "Unknown",
            profile_image_url:
              selectedProposal?.match?.user2?.profile_image_url,
            email: selectedProposal?.match?.user2?.email,
          }}
          user1Card={selectedProposal?.match?.user1_cards?.[0]}
          user2Card={selectedProposal?.match?.user2_cards?.[0]}
          isBundle={selectedProposal?.match?.is_bundle}
          user1Cards={selectedProposal?.match?.user1_cards}
          user2Cards={selectedProposal?.match?.user2_cards}
        />
      )} */}
    </div>
  );
};
