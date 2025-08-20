import { useState, useCallback, useEffect, useMemo } from "react";
import type { JSX } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  useTradeProposals,
  useTradeProposalForMatch,
} from "../hooks/useTradeProposals";
import { useShippingPreferences } from "../hooks/useShippingPreferences";
import { Card, ShippingPreference, TradeProposal } from "../types";
import {
  AlertCircle,
  Truck,
  ArrowLeftRight,
  MessageCircle,
  Check,
  CheckCircle,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";

// Import components
import ShippingPreferenceForm from "./ShippingPreferenceForm";
import ShippingMethodSelector from "./ShippingMethodSelector";
import ShippingModal from "./ShippingModal";

// Types
type ModalStep =
  | "propose"
  | "accept"
  | "confirm"
  | "shipping"
  | "create_label"
  | "waiting_for_label"
  | "complete";

interface TradeProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  matchScore: number;
  user1: {
    id: string;
    username: string;
    profile_image_url?: string;
    email?: string;
  };
  user2: {
    id: string;
    username: string;
    profile_image_url?: string;
    email?: string;
  };
  user1Card?: Card;
  user2Card?: Card;
  isBundle?: boolean;
  user1Cards?: Card[];
  user2Cards?: Card[];
}

const TradeProposalModal = ({
  isOpen,
  onClose,
  matchId,
  matchScore,
  user1,
  user2,
  user1Card,
  user2Card,
  isBundle = false,
  user1Cards = [],
  user2Cards = [],
}: TradeProposalModalProps): JSX.Element | null => {
  // State management
  const [step, setStep] = useState<ModalStep>("propose");
  const [shippingMethod, setShippingMethod] = useState<"mail" | "local_meetup">(
    "mail"
  );
  // const [isUpdatingDefault, setIsUpdatingDefault] = useState(false);
  // const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [existingProposal, setExistingProposal] =
    useState<TradeProposal | null>(null);
  const [isShippingModalOpen, setShippingModalOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [labelUrl, setLabelUrl] = useState("");
  // State for recipient's shipping preferences
  const [recipientPrefs, setRecipientPrefs] = useState<ShippingPreference[]>(
    []
  );

  // Auth and data hooks
  const { user } = useAuth();

  // Memoize derived values
  const otherUserId = useMemo(
    () => (user?.id === user1.id ? user2.id : user1.id),
    [user?.id, user1.id, user2.id]
  );

  const otherUser = useMemo(
    () => (user?.id === user1.id ? user2 : user1),
    [user?.id, user1, user2]
  );

  // Determine if current user is proposer or recipient
  const isProposer = useMemo(
    () =>
      existingProposal
        ? existingProposal.proposer_id === user?.id
        : user?.id === user1.id,
    [existingProposal, user?.id, user1.id]
  );

  // Enhanced debug logging for step changes
  useEffect(() => {
    console.log(
      "%c🔍 TradeProposalModal STEP CHANGE",
      "color: #4CAF50; font-weight: bold;",
      {
        step,
        timestamp: new Date().toISOString(),
        component: "TradeProposalModal",
      }
    );
  }, [step]);

  // Enhanced debug logging for header state
  useEffect(() => {
    console.log(
      "%c📝 TradeProposalModal STATE",
      "color: #2196F3; font-weight: bold;",
      {
        step,
        isProposer,
        currentUserId: user?.id,
        proposal: existingProposal
          ? {
              id: existingProposal.id,
              status: existingProposal.status,
              proposer_id: existingProposal.proposer_id,
              recipient_id: existingProposal.recipient_id,
              shipping_method: existingProposal.shipping_method,
            }
          : null,
        otherUserId,
        timestamp: new Date().toISOString(),
      }
    );
  }, [step, existingProposal, isProposer, user?.id, otherUserId]);

  // Memoized handlers and derived state
  // const handleClose = useCallback(() => {
  //   onClose();
  //   setStep('propose');
  //   setMessage(null);
  // }, [onClose]);

  const handleMessage = useCallback(
    (type: "success" | "error" | "info", text: string) => {
      setMessage({ type, text });
    },
    []
  );

  const { createProposal, updateProposal, deleteProposal } = useTradeProposals(
    user?.id
  );

  // Fetch the proposal using matchId
  const {
    proposal: fetchedProposal,
    updateProposal: updateFetchedProposal,
    refetch: refetchProposal,
  } = useTradeProposalForMatch(matchId, user?.id);

  // Current user's shipping preferences
  const {
    shippingPreferences = [],
    fetchShippingPreferences,
    addShippingPreference,
    updateShippingPreference,
  } = useShippingPreferences(user?.id || "");

  const [isUpdatingDefault, setIsUpdatingDefault] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null
  );

  const handleAddressClick = useCallback(
    async (addressId: string) => {
      if (isUpdatingDefault) return;

      try {
        setIsUpdatingDefault(true);
        setSelectedAddressId(addressId);
        await updateShippingPreference(addressId, { is_default: true });
        await fetchShippingPreferences(); // Refresh the list
      } catch (error) {
        console.error("Error updating default address:", error);
        handleMessage("error", "Failed to update default address");
      } finally {
        setIsUpdatingDefault(false);
      }
    },
    [
      isUpdatingDefault,
      updateShippingPreference,
      fetchShippingPreferences,
      handleMessage,
    ]
  );

  // Initialize recipient's shipping preferences
  const { fetchShippingPreferences: fetchRecipientPreferences } =
    useShippingPreferences("");

  // Fetch recipient's preferences when otherUserId is available
  useEffect(() => {
    if (otherUserId) {
      console.log("Fetching shipping preferences for recipient:", otherUserId);
      fetchRecipientPreferences(otherUserId).catch((error) => {
        console.error("Error fetching recipient shipping preferences:", error);
        handleMessage("error", "Failed to load recipient shipping preferences");
      });
    }
  }, [otherUserId, fetchRecipientPreferences, handleMessage]);

  // Update existingProposal when fetchedProposal changes
  useEffect(() => {
    if (fetchedProposal) {
      setExistingProposal(fetchedProposal);
    }
  }, [fetchedProposal]);

  // Memoize the refetch function to prevent unnecessary re-renders
  const memoizedRefetchProposal = useCallback(async () => {
    if (refetchProposal) {
      const updatedProposal = await refetchProposal();
      if (updatedProposal) {
        setExistingProposal(updatedProposal);
      }
      return updatedProposal;
    }
  }, [refetchProposal]);

  useEffect(() => {
    if (otherUserId) {
      console.log("Other user ID set to:", otherUserId);
    }
  }, [otherUserId]);

  // Combine update functions to ensure both are called
  const handleUpdateProposal = useCallback(
    async (id: string, updates: Partial<TradeProposal>) => {
      const result = await updateProposal(id, updates);
      await updateFetchedProposal(id, updates);
      return result;
    },
    [updateProposal, updateFetchedProposal]
  );

  const isRecipient = existingProposal
    ? existingProposal.recipient_id === user?.id
    : user?.id === user2.id;

  // Fetch shipping preferences when component mounts
  useEffect(() => {
    if (user?.id) {
      // Fetch current user's shipping preferences
      fetchShippingPreferences();

      // Fetch recipient's shipping preferences
      const loadRecipientPrefs = async () => {
        try {
          const prefs = await fetchRecipientPreferences();
          if (prefs) setRecipientPrefs(prefs);
        } catch (error) {
          console.error("Error loading recipient preferences:", error);
        }
      };

      loadRecipientPrefs();
    }
  }, [user?.id, fetchShippingPreferences, fetchRecipientPreferences]);

  // Determine user roles and other user data

  // Update step based on proposal status
  useEffect(() => {
    if (!existingProposal || !isOpen) return;

    console.log(
      "Updating step based on proposal status:",
      existingProposal.status
    );

    if (existingProposal.status === "proposed") {
      setStep(isRecipient ? "accept" : "propose");
    } else if (existingProposal.status === "accepted_by_recipient") {
      setStep(isProposer ? "confirm" : "accept");
    } else if (
      existingProposal.status === "shipping_pending" ||
      existingProposal.status === "shipping_confirmed"
    ) {
      setStep("shipping");
      const method = existingProposal.shipping_method as
        | "mail"
        | "local_meetup"
        | undefined;
      setShippingMethod(method || "mail");
    } else if (existingProposal.status === "completed") {
      setStep("complete");
    }
  }, [existingProposal, isRecipient, isProposer, isOpen]);

  // Fetch shipping preferences on mount
  useEffect(() => {
    if (user?.id) {
      fetchShippingPreferences();
    }
  }, [user?.id, fetchShippingPreferences]);

  // Handle shipping confirmation is defined later in the file

  // Handle saving a new shipping address
  const handleSaveAddress = useCallback(
    async (
      address: Omit<ShippingPreference, "id" | "user_id" | "created_at">
    ) => {
      if (!user) return false;

      try {
        setIsProcessing(true);
        const newAddress = await addShippingPreference({
          ...address,
          is_default: shippingPreferences.length === 0, // Set as default if this is the first address
        });

        // Refresh the shipping preferences
        await fetchShippingPreferences();

        return newAddress;
      } catch (error) {
        console.error("Error saving address:", error);
        handleMessage(
          "error",
          "Failed to save shipping address. Please try again."
        );
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [
      addShippingPreference,
      fetchShippingPreferences,
      shippingPreferences.length,
      user,
      handleMessage,
    ]
  );

  const handleRequestRecipientAddress = useCallback(async () => {
    try {
      // Implementation of handleRequestRecipientAddress
      // ...
    } catch (error) {
      console.error("Error requesting recipient address:", error);
      setMessage({
        type: "error",
        text: "Failed to request recipient address. Please try again.",
      });
    }
  }, [existingProposal?.id, user?.id]);

  const handleShippingComplete = useCallback(() => {
    setMessage({
      type: "success",
      text: "Shipping label created successfully!",
    });
    // Close the shipping modal
    setShippingModalOpen(false);
    // You might want to refresh the trade proposal data here
    // or update the UI to reflect the new shipping status
  }, []);

  // Validate trade proposal data
  const isValidData = useCallback((): boolean => {
    if (isBundle) {
      return (user1Cards?.length ?? 0) > 0 && (user2Cards?.length ?? 0) > 0;
    }
    return !!user1Card && !!user2Card;
  }, [isBundle, user1Card, user2Card, user1Cards, user2Cards]);

  // Handle proposing a new trade
  const handlePropose = useCallback(async () => {
    if (!user || !isValidData()) {
      setMessage({
        type: "error",
        text: "Cannot create proposal with invalid data",
      });
      return;
    }

    // Get the default shipping address for the current user
    const defaultAddress =
      shippingPreferences.find((addr) => addr.is_default) ||
      shippingPreferences[0];
    if (!defaultAddress) {
      setMessage({
        type: "error",
        text: "Please add a shipping address before proposing a trade",
      });
      return;
    }

    // Check if proposal already exists
    if (existingProposal) {
      setMessage({
        type: "error",
        text: "A trade proposal already exists for this match",
      });
      return;
    }

    try {
      setIsProcessing(true);
      setMessage(null);

      await createProposal({
        match_id: matchId,
        proposer_id: user.id,
        recipient_id: otherUser.id,
        shipping_method: shippingMethod,
        status: "proposed" as const,
        proposer_address_id: defaultAddress.id,
      });

      setMessage({
        type: "success",
        text: `Trade proposal sent to ${otherUser.username}!`,
      });

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error proposing trade:", error);
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Failed to propose trade",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    user?.id,
    matchId,
    isValidData,
    shippingPreferences,
    existingProposal,
    shippingMethod,
    otherUser.id,
    otherUser.username,
    createProposal,
    onClose,
  ]);

  // Handle accepting a trade proposal
  // const handleAccept = useCallback(async () => {
  //   if (!existingProposal || !user) return;

  //   // Validate that we can accept this proposal
  //   if (existingProposal.status !== "proposed") {
  //     setMessage({
  //       type: "error",
  //       text: "This trade proposal can no longer be accepted.",
  //     });
  //     return;
  //   }

  //   // Ensure the current user is the recipient
  //   if (existingProposal.recipient_id !== user.id) {
  //     setMessage({
  //       type: "error",
  //       text: "You are not authorized to accept this trade proposal.",
  //     });
  //     return;
  //   }

  //   try {
  //     setIsAccepting(true);
  //     setMessage(null);

  //     // Update the proposal status to accepted_by_recipient
  //     await handleUpdateProposal(existingProposal.id, {
  //       status: "accepted_by_recipient",
  //       recipient_confirmed: true,
  //       updated_at: new Date().toISOString(),
  //     });

  //     setMessage({
  //       type: "success",
  //       text: "Trade accepted! Waiting for final confirmation.",
  //     });

  //     await memoizedRefetchProposal();
  //   } catch (error) {
  //     console.error("Error accepting trade:", error);
  //     setMessage({
  //       type: "error",
  //       text: error instanceof Error ? error.message : "Failed to accept trade",
  //     });
  //   } finally {
  //     setIsAccepting(false);
  //   }
  // }, [existingProposal, user, handleUpdateProposal, memoizedRefetchProposal]);

  // In TradeProposalModal.tsx, update the handleAccept function:
const handleAccept = useCallback(async () => {
  if (!existingProposal || !user) return;

  // Validate that we can accept this proposal
  if (existingProposal.status !== "proposed") {
    setMessage({
      type: "error",
      text: "This trade proposal can no longer be accepted.",
    });
    return;
  }

  // Ensure the current user is the recipient
  if (existingProposal.recipient_id !== user.id) {
    setMessage({
      type: "error",
      text: "You are not authorized to accept this trade proposal.",
    });
    return;
  }

  try {
    setIsAccepting(true);
    setMessage(null);
    
    // Use the acceptProposal function from useTradeProposals
    await acceptProposal(existingProposal.id);
    
    setMessage({
      type: "success",
      text: "Trade accepted!",
    });
    
    // Refresh the proposal data
    await memoizedRefetchProposal();
  } catch (error) {
    console.error("Error accepting trade:", error);
    setMessage({
      type: "error",
      text: error instanceof Error ? error.message : "Failed to accept trade",
    });
  } finally {
    setIsAccepting(false);
  }
}, [existingProposal, user, acceptProposal, memoizedRefetchProposal]);

  // Handle confirming a trade proposal
  const handleConfirm = useCallback(async () => {
    if (!existingProposal || !user) return;

    try {
      setIsProcessing(true);
      setMessage(null);

      await handleUpdateProposal(existingProposal.id, {
        status: "confirmed",
        proposer_confirmed: true,
        updated_at: new Date().toISOString(),
      });

      setMessage({
        type: "success",
        text: "Trade confirmed! Please set up shipping details.",
      });

      await memoizedRefetchProposal();
    } catch (error) {
      console.error("Error confirming trade:", error);
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Failed to confirm trade",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [existingProposal, user, handleUpdateProposal, memoizedRefetchProposal]);

  // Handle declining a trade proposal
  const handleDecline = useCallback(async () => {
    if (!existingProposal || !user) return;

    try {
      setIsDeclining(true);
      setMessage(null);

      await handleUpdateProposal(existingProposal.id, {
        status: "declined",
        updated_at: new Date().toISOString(),
      });

      setMessage({
        type: "info",
        text: "Trade proposal declined.",
      });

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error declining trade:", error);
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Failed to decline trade",
      });
    } finally {
      setIsDeclining(false);
    }
  }, [existingProposal, user, handleUpdateProposal, onClose]);

  // Handle deleting a trade proposal
  const handleDelete = useCallback(async () => {
    if (!existingProposal || !user) return;

    try {
      setIsProcessing(true);
      setMessage(null);

      await deleteProposal(existingProposal.id);

      setMessage({
        type: "info",
        text: "Trade proposal deleted.",
      });

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error deleting trade:", error);
      setMessage({
        type: "error",
        text: "Failed to delete trade proposal",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [existingProposal, user, deleteProposal, onClose]);

  // Handle selecting shipping method
  const handleSelectShippingMethod = useCallback(
    async (method: "mail" | "local_meetup") => {
      if (!existingProposal || !user) return;

      try {
        setIsProcessing(true);
        setMessage(null);

        await handleUpdateProposal(existingProposal.id, {
          shipping_method: method,
        });

        setShippingMethod(method);

        setMessage({
          type: "success",
          text: `Shipping method set to ${
            method === "mail" ? "Mail" : "Local Meetup"
          }`,
        });

        await memoizedRefetchProposal();
      } catch (error) {
        console.error("Error selecting shipping method:", error);
        setMessage({
          type: "error",
          text: "Failed to set shipping method",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [existingProposal, user, handleUpdateProposal, memoizedRefetchProposal]
  );

  // Handle confirming shipping details
  const handleConfirmShipping = useCallback(async () => {
    if (!existingProposal || !user) return;

    if (existingProposal.shipping_method === "mail" && !selectedAddressId) {
      setMessage({
        type: "error",
        text: "Please select a shipping address",
      });
      return;
    }

    try {
      setIsProcessing(true);
      setMessage(null);

      const updates: any = {
        status: "shipping_pending",
      };

      if (existingProposal.shipping_method === "mail" && selectedAddressId) {
        if (isProposer) {
          updates.proposer_address_id = selectedAddressId;
        } else {
          updates.recipient_address_id = selectedAddressId;
        }
      }

      await handleUpdateProposal(existingProposal.id, updates);

      setMessage({
        type: "success",
        text: "Shipping details confirmed!",
      });

      await memoizedRefetchProposal();
    } catch (error) {
      console.error("Error confirming shipping:", error);
      setMessage({
        type: "error",
        text: "Failed to confirm shipping details",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    existingProposal,
    user,
    selectedAddressId,
    isProposer,
    handleUpdateProposal,
    memoizedRefetchProposal,
  ]);

  // Handle address form success
  const handleAddressFormSuccess = useCallback(() => {
    setShowAddressForm(false);
    // Refresh shipping preferences to get the new address
    fetchShippingPreferences();
  }, [fetchShippingPreferences]);

  // Render trade details
  const renderTradeDetails = useCallback(() => {
    const myCards = isProposer ? user1Cards : user2Cards;
    const theirCards = isProposer ? user2Cards : user1Cards;
    const myCard = myCards?.[0] || (isProposer ? user1Card : user2Card);
    const theirCard = theirCards?.[0] || (isProposer ? user2Card : user1Card);

    const renderCard = (card: Card | undefined) => {
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
            className="w-16 h-20 object-cover rounded-lg shadow-md"
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
                ? parseFloat(String(card.market_price)).toFixed(2)
                : "0.00"}
            </p>
          </div>
        </div>
      );
    };

    return (
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
          <ArrowLeftRight className="h-5 w-5 mr-2" />
          Trade Details
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h5 className="font-medium text-blue-900 mb-2">
              Your {isBundle ? "Cards" : "Card"}
            </h5>
            {isBundle ? (
              <div className="space-y-2">
                {myCards?.slice(0, 2).map((card, index) => (
                  <div
                    key={card.id || index}
                    className="flex items-center space-x-2"
                  >
                    <img
                      src={
                        card.image_url ||
                        "https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2"
                      }
                      alt={card.name || "Card"}
                      className="w-8 h-10 object-cover rounded"
                    />
                    <span className="text-sm font-medium">{card.name}</span>
                  </div>
                ))}
                {(myCards?.length || 0) > 2 && (
                  <p className="text-sm text-gray-600">
                    +{(myCards?.length || 0) - 2} more cards
                  </p>
                )}
              </div>
            ) : (
              renderCard(myCard)
            )}
          </div>
          <div className="bg-gray-100 p-4 rounded-lg border border-gray-200">
            <h5 className="font-medium text-gray-900 mb-2">
              Their {isBundle ? "Cards" : "Card"}
            </h5>
            {isBundle ? (
              <div className="space-y-2">
                {theirCards?.slice(0, 2).map((card, index) => (
                  <div
                    key={card.id || index}
                    className="flex items-center space-x-2"
                  >
                    <img
                      src={
                        card.image_url ||
                        "https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2"
                      }
                      alt={card.name || "Card"}
                      className="w-8 h-10 object-cover rounded"
                    />
                    <span className="text-sm font-medium">{card.name}</span>
                  </div>
                ))}
                {(theirCards?.length || 0) > 2 && (
                  <p className="text-sm text-gray-600">
                    +{(theirCards?.length || 0) - 2} more cards
                  </p>
                )}
              </div>
            ) : (
              renderCard(theirCard)
            )}
          </div>
        </div>
      </div>
    );
  }, [isProposer, user1Cards, user2Cards, user1Card, user2Card, isBundle]);

  // Render message display
  const renderMessage = () => {
    if (!message) return null;

    const bgColor =
      message.type === "success"
        ? "bg-green-50 border-green-200"
        : message.type === "error"
        ? "bg-red-50 border-red-200"
        : "bg-blue-50 border-blue-200";
    const textColor =
      message.type === "success"
        ? "text-green-800"
        : message.type === "error"
        ? "text-red-800"
        : "text-blue-800";
    const iconColor =
      message.type === "success"
        ? "text-green-600"
        : message.type === "error"
        ? "text-red-600"
        : "text-blue-600";

    return (
      <div className={`p-4 rounded-lg border ${bgColor} mb-4`}>
        <div className="flex items-start space-x-3">
          {message.type === "success" ? (
            <CheckCircle className={`h-5 w-5 ${iconColor} mt-0.5`} />
          ) : message.type === "error" ? (
            <X className={`h-5 w-5 ${iconColor} mt-0.5`} />
          ) : (
            <AlertCircle className={`h-5 w-5 ${iconColor} mt-0.5`} />
          )}
          <p className={`text-sm ${textColor}`}>{message.text}</p>
        </div>
      </div>
    );
  };

  // Effect to handle shipping info updates
  useEffect(() => {
    if (!existingProposal) return;

    const updateShippingInfo = async () => {
      // Initialize updateData object to store shipping updates
      const updateData: any = {};

      // Update the appropriate fields based on who is shipping
      if (isProposer) {
        updateData.proposer_tracking_number = trackingNumber;
        updateData.proposer_carrier = carrier;
        updateData.proposer_label_url = labelUrl;
        updateData.proposer_shipping_confirmed = true;
      } else {
        updateData.recipient_tracking_number = trackingNumber;
        updateData.recipient_carrier = carrier;
        updateData.recipient_label_url = labelUrl;
        updateData.recipient_shipping_confirmed = true;
      }

      // Keep the old fields for backward compatibility
      updateData.tracking_number = trackingNumber;
      updateData.carrier = carrier;
      updateData.label_url = labelUrl;

      if (!existingProposal) {
        console.error("No existing proposal found");
        handleMessage("error", "No trade proposal found to update");
        return;
      }

      const { error } = await supabase
        .from("trade_proposals")
        .update(updateData)
        .eq("id", existingProposal.id);

      if (error) {
        console.error("Error updating trade with tracking info:", error);
        handleMessage(
          "error",
          "Failed to update trade with tracking information"
        );
        return;
      }

      // Update the local state
      setExistingProposal((prev) => ({
        ...prev!,
        ...updateData,
        updated_at: new Date().toISOString(),
      }));

      // Refresh the trade proposal data using the memoized function
      await memoizedRefetchProposal();
    };

    // Execute the async function
    // Only run updateShippingInfo if we have all required data
    if (existingProposal && trackingNumber && carrier) {
      updateShippingInfo();
    }
  }, [
    existingProposal,
    handleMessage,
    memoizedRefetchProposal,
    refetchProposal,
    isProposer,
    trackingNumber,
    carrier,
    labelUrl,
    supabase,
  ]);

  // Handle modal close with cleanup
  const handleClose = useCallback(() => {
    // Reset any necessary state here
    setMessage(null);
    onClose();
  }, [onClose]);

  // Add a class to control the modal's visibility with transitions
  const modalClasses = `fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300 ${
    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
  }`;
  const contentClasses = `bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-transform duration-300 ${
    isOpen ? "scale-100" : "scale-95"
  }`;

  // Get modal title based on step
  const getModalTitle = () => {
    switch (step) {
      case "propose":
        return existingProposal ? "Trade Proposed" : "Propose Trade";
      case "accept":
        return "Accept Trade";
      case "confirm":
        return "Confirm Trade";
      case "shipping":
        return "Shipping Details";
      case "create_label":
        return "Create Shipping Label";
      case "waiting_for_label":
        return "Waiting for Shipping Label";
      case "complete":
        return "Trade Complete";
      default:
        return "Trade Proposal";
    }
  };

  // Get modal title based on step
  const getModalDescription = () => {
    switch (step) {
      case "propose":
        return existingProposal
          ? "Waiting for response from the other trader"
          : "Initiate a trade with another user";
      case "accept":
        return "Review and accept the trade proposal";
      case "confirm":
        return "Final confirmation of the trade";
      case "shipping":
        return "Select shipping method and confirm details";
      case "create_label":
        return "Create shipping labels for the trade";
      case "waiting_for_label":
        return "Waiting for shipping label to be created";
      case "complete":
        return "Trade has been completed successfully";
      default:
        return "Manage your trade proposal";
    }
  };
  if (!isOpen) return null;

  return (
    <div className={modalClasses} onClick={handleClose}>
      <div className={contentClasses} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {getModalTitle()}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {getModalDescription()}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {step === "propose" && !existingProposal && (
          <div className="space-y-6 p-6">
            {renderMessage()}
            {renderTradeDetails()}

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">
                    Trade Proposal Information
                  </h4>
                  <p className="text-sm text-blue-800 mt-1">
                    You're about to propose a trade with {otherUser.username}.
                    Once proposed, they'll be notified and can accept or decline
                    your offer.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handlePropose}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Proposing Trade...</span>
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="h-5 w-5" />
                    <span>Propose Trade</span>
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === "propose" && existingProposal && (
          <div className="space-y-6 p-6">
            {renderMessage()}
            {renderTradeDetails()}

            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-start space-x-3">
                <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-900">
                    Waiting for Response
                  </h4>
                  <p className="text-sm text-yellow-800 mt-1">
                    Your trade proposal has been sent to {otherUser.username}.
                    You'll be notified when they respond.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleDelete}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5" />
                    <span>Delete Proposal</span>
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {step === "accept" && existingProposal && (
          <div className="space-y-6 p-6">
            {renderMessage()}
            {renderTradeDetails()}

            {existingProposal.status === "accepted_by_recipient" ? (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-900">
                      Trade Accepted
                    </h4>
                    <p className="text-sm text-green-800 mt-1">
                      You've accepted this trade. Waiting for{" "}
                      {otherUser.username} to confirm.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">
                      Trade Proposal Received
                    </h4>
                    <p className="text-sm text-blue-800 mt-1">
                      {otherUser.username} has proposed a trade with you. Review
                      the details and decide if you want to accept.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex space-x-4">
              {existingProposal.status !== "accepted_by_recipient" && (
                <button
                  onClick={handleAccept}
                  disabled={isAccepting || isDeclining}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Accepting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      <span>Accept Trade</span>
                    </>
                  )}
                </button>
              )}
              <button
                onClick={
                  existingProposal.status === "accepted_by_recipient"
                    ? onClose
                    : handleDecline
                }
                disabled={isAccepting || isDeclining}
                className={`flex-1 flex items-center justify-center space-x-2 px-6 py-3 ${
                  existingProposal.status === "accepted_by_recipient"
                    ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    : "bg-red-600 text-white hover:bg-red-700"
                } rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200`}
              >
                {isDeclining ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    {existingProposal.status === "accepted_by_recipient" ? (
                      <span>Close</span>
                    ) : (
                      <>
                        <X className="h-5 w-5" />
                        <span>Decline Trade</span>
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === "confirm" && existingProposal && (
          <div className="space-y-6 p-6">
            {renderMessage()}
            {renderTradeDetails()}

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">
                    Final Confirmation
                  </h4>
                  <p className="text-sm text-blue-800 mt-1">
                    {otherUser.username} has accepted your trade proposal.
                    Please confirm to proceed with the trade.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleConfirm}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    <span>Confirm Trade</span>
                  </>
                )}
              </button>
              <button
                onClick={handleDecline}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5" />
                    <span>Cancel Trade</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === "shipping" && existingProposal && (
          <div className="space-y-6 p-6">
            {renderMessage()}

            {/* Shipping Method Selection */}
            {!existingProposal.shipping_method && (
              <ShippingMethodSelector
                onSelect={handleSelectShippingMethod}
                loading={isProcessing}
                onCancel={onClose}
              />
            )}

            {/* Mail Shipping Details */}
            {existingProposal.shipping_method === "mail" && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Shipping Details
                </h3>

                {/* Shipping Address Form */}
                {showAddressForm ? (
                  <div className="mb-6">
                    <ShippingPreferenceForm
                      onSave={handleAddressFormSuccess}
                      onCancel={() => setShowAddressForm(false)}
                    />
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">
                        Your Shipping Address
                      </h4>
                      <button
                        onClick={() => setShowAddressForm(true)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        {shippingPreferences.length > 0
                          ? "Add New Address"
                          : "Add Address"}
                      </button>
                    </div>

                    {shippingPreferences.length > 0 ? (
                      <div className="space-y-3">
                        {shippingPreferences.map((address) => (
                          <div
                            key={address.id}
                            onClick={() => handleAddressClick(address.id)}
                            className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                              selectedAddressId === address.id
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h5 className="font-medium text-gray-900">
                                  {address.address_name}
                                </h5>
                                <p className="text-sm text-gray-600">
                                  {address.street1}
                                  {address.street2
                                    ? `, ${address.street2}`
                                    : ""}
                                  , {address.city}, {address.state}{" "}
                                  {address.zip}
                                </p>
                              </div>
                              {selectedAddressId === address.id && (
                                <Check className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-yellow-900">
                              No Shipping Addresses
                            </h4>
                            <p className="text-sm text-yellow-800 mt-1">
                              Please add a shipping address to continue with the
                              trade.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Shipping Instructions */}
                {!showAddressForm && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
                    <h4 className="font-medium text-blue-900 mb-2">
                      Shipping Instructions
                    </h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>
                        • Package cards securely with protective sleeves and
                        rigid mailers
                      </li>
                      <li>
                        • Include a note with your username and trade details
                      </li>
                      <li>• Use tracking and insurance for valuable cards</li>
                      <li>• Share tracking information in the trade chat</li>
                      <li>
                        • Keep your shipping receipt until delivery is confirmed
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Local Meetup Details */}
            {existingProposal.shipping_method === "local_meetup" && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Local Meetup
                </h3>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">
                    Meetup Safety Guidelines
                  </h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>
                      • Always meet in a public place (coffee shops, card
                      stores, malls)
                    </li>
                    <li>• Consider meeting during daylight hours</li>
                    <li>
                      • Let someone know where you're going and who you're
                      meeting
                    </li>
                    <li>• Bring a friend if possible</li>
                    <li>
                      • Inspect cards carefully before completing the trade
                    </li>
                    <li>
                      • Use the chat feature to coordinate meeting details
                    </li>
                  </ul>
                </div>

                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setStep("create_label")}
                    className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                  >
                    <MessageCircle className="h-5 w-5" />
                    <span>Open Chat to Coordinate</span>
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Shipping Button */}
            {existingProposal.shipping_method && !showAddressForm && (
              <div className="flex space-x-4">
                <button
                  onClick={handleConfirmShipping}
                  disabled={
                    isProcessing ||
                    (existingProposal.shipping_method === "mail" &&
                      !selectedAddressId)
                  }
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Truck className="h-5 w-5" />
                      <span>Confirm Shipping</span>
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {step === "create_label" && existingProposal && user && (
          <ShippingModal
            isOpen={isShippingModalOpen}
            onClose={() => setShippingModalOpen(false)}
            tradeId={existingProposal.id}
            user={user}
            otherUser={otherUser}
            isProposer={user.id === existingProposal.proposer_id}
            onShippingComplete={handleShippingComplete}
            onShippingError={(error) => {
              setMessage({
                type: "error",
                text: error,
              });
            }}
            onSaveAddress={handleSaveAddress}
            onRequestRecipientAddress={handleRequestRecipientAddress}
            shippingPreferences={shippingPreferences}
            recipientShippingPreferences={recipientPrefs}
          />
        )}

        {step === "waiting_for_label" && (
          <div className="text-center p-6 bg-white rounded-lg shadow">
            <div className="flex flex-col items-center">
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Waiting for Shipping Label
              </h3>
              <p className="text-gray-600 mb-4">
                {otherUser.username} is preparing the shipping label. You'll
                receive a notification once it's ready.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="space-y-6 text-center p-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Trade Completed!
              </h3>
              <p className="text-gray-600">
                Your trade with {otherUser.username} has been successfully
                completed.
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-900 mb-2">Next Steps:</h4>
              {existingProposal?.shipping_method === "mail" ? (
                <ul className="text-sm text-green-800 space-y-1 text-left">
                  <li>
                    • Track your package using the provided tracking number
                  </li>
                  <li>• Confirm receipt of the cards in the trade chat</li>
                  <li>
                    • Rate your trading experience with {otherUser.username}
                  </li>
                  <li>• Add the new cards to your collection</li>
                </ul>
              ) : (
                <ul className="text-sm text-green-800 space-y-1 text-left">
                  <li>• The trade has been marked as completed</li>
                  <li>
                    • Rate your trading experience with {otherUser.username}
                  </li>
                  <li>• Add the new cards to your collection</li>
                  <li>• Check your Profile page to see this completed trade</li>
                </ul>
              )}
            </div>

            <button
              onClick={onClose}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradeProposalModal;
