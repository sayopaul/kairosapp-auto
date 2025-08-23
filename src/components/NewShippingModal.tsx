import { X, Download, CheckCircle, Package, AlertTriangle, ExternalLink } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { shippoService, type ShippingRate } from "../services/shippoService";
import { ShippingPreference, TradeProposal } from "../types";
import { useTradeProposals } from "../hooks/useTradeProposals";

interface Address {
  id: string;
  first_name?: string;
  last_name?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
  is_default: boolean;
  address_name?: string;
}

interface User {
  id: string;
  email?: string;
  displayName?: string;
}

interface LabelResponse {
  object_state: string;
  status: string;
  object_created: string;
  object_updated: string;
  object_id: string;
  object_owner: string;
  test: boolean;
  rate: string;
  tracking_number: string;
  tracking_status: string;
  eta: string | null;
  tracking_url_provider: string;
  label_url: string;
  commercial_invoice_url: string | null;
  messages: unknown[];
  order: unknown | null;
  metadata: string;
  parcel: string;
  billing: {
    payments: unknown[];
  };
  qr_code_url: string | null;
  created_by: {
    first_name: string;
    last_name: string;
    username: string;
  };
}

/**
 * Props interface for the NewShippingModal component
 */
interface ShippingModalNewProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback function to close the modal */
  onClose: () => void;
  /** Array of user's shipping preferences/addresses */
  shippingPreferences: ShippingPreference[];
  /** Recipient shipping preferences */
  recipientShippingPreferences: ShippingPreference[];
  /** User object containing user information */
  user: User;
  /** Recipient address */
  otherUser: User;
  proposal: TradeProposal;
  isProposer: boolean;
}

/**
 * Enumeration of possible steps in the shipping modal flow
 */
type Step =
  | "rates"
  | "confirm_shipping"
  | "confirmation"
  | "address"
  | "check_recipient";

/**
 * NewShippingModal Component
 *
 * A modal component for handling shipping information and rate selection.
 * Manages a multi-step flow: rates selection → shipping confirmation → completion.
 *
 * @param onClose - Function to close the modal
 * @param shippingPreferences - User's saved shipping preferences
 */
export default function ShippingModalNew({
  isOpen,
  onClose,
  shippingPreferences = [],
  recipientShippingPreferences = [],
  user,
  otherUser,
  proposal,
  isProposer,
}: ShippingModalNewProps) {
  // State management for error handling
  const [error, setError] = useState<string | null>(null);

  // State management for modal flow control
  const [step, setStep] = useState<Step>("rates");

  // State management for shipping rates
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);

  // State management for loading states
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // State management for address selection
  // Initialize with the default shipping preference if available
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    () => shippingPreferences?.find((p) => p.is_default)?.id || ""
  );

  // Trade proposals hooks
  const { updateProposal, updateShippingStatus } = useTradeProposals(user?.id);

  /**
   * Handles the process of fetching shipping rates for a given recipient address
   *
   * @param recipientAddress - The destination address for shipping calculation
   */
  const handleGetRates = useCallback(
    async (recipientAddress: Address): Promise<void> => {
      // Validate that recipient address is provided
      if (!recipientAddress) {
        setError("Recipient address is required");
        return;
      }

      try {
        setIsLoading(true);
        setError("");

        // Get the selected shipping address from preferences
        const selectedAddress = shippingPreferences?.find(
          (addr) => addr.id === selectedAddressId
        );

        if (!selectedAddress) {
          setError("Please select a shipping address");
          return;
        }

        // Prepare addresses for rate calculation
        const fromAddress = {
          name: user?.displayName || "Sender",
          street1: selectedAddress.street1,
          street2: selectedAddress.street2 || "",
          city: selectedAddress.city,
          state: selectedAddress.state,
          zip: selectedAddress.zip,
          country: selectedAddress.country || "US",
          phone: selectedAddress.phone || "",
          email: user?.email || "",
        };

        const toAddress = {
          name: otherUser.displayName || "Recipient",
          street1: recipientAddress.street1,
          street2: recipientAddress.street2 || "",
          city: recipientAddress.city,
          state: recipientAddress.state,
          zip: recipientAddress.zip,
          country: recipientAddress.country || "US",
          phone: recipientAddress.phone || "",
          email: recipientAddress.email || "",
        };

        console.log("Sender address:", fromAddress);
        console.log("Recipient address:", toAddress);

        // Get shipping rates
        const ratesResponse = await shippoService.getRates(
          fromAddress,
          toAddress
        );

        console.log("Rates response:", ratesResponse);

        if (!ratesResponse || ratesResponse.length === 0) {
          throw new Error(
            "No shipping rates available for the provided addresses."
          );
        }

        // Filter and sort rates
        const filteredRates = ratesResponse
          .filter(
            (rate: ShippingRate) =>
              rate.servicelevel?.token &&
              [
                "usps_priority",
                "usps_priority_express",
                "usps_ground_advantage",
              ].includes(rate.servicelevel?.token)
          )
          .sort(
            (a: ShippingRate, b: ShippingRate) =>
              parseFloat(a.amount) - parseFloat(b.amount)
          );

        console.log("Filtered rates:", filteredRates);
        console.log(
          "Available service level tokens:",
          ratesResponse.map((r: ShippingRate) => r.servicelevel?.token)
        );

        setRates(filteredRates);
        setStep("rates");

        // TODO: Implement shipping rate calculation logic
        // This would typically involve:
        // 1. Calling a shipping API (e.g., Shippo, EasyPost)
        // 2. Passing origin and destination addresses
        // 3. Setting the calculated rates in state
      } catch (error) {
        console.error("Error in handleGetRates:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to get shipping rates";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedAddressId, user, otherUser, shippingPreferences]
  );

  const [labelResponse, setLabelResponse] = useState<LabelResponse | null>(
    null
  );

  const handleCreateLabel = useCallback(async () => {
    // TODO: Implement label creation logic
    console.log("Creating shipping label...");
    if (!selectedRate) {
      setError("Please select a shipping rate");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const selectedAddress = shippingPreferences?.find(
        (addr) => addr.id === selectedAddressId
      );
      if (!selectedAddress) {
        setError("Please select a shipping address");
        return;
      }

      // Prepare the sender's address
      const fromAddress = {
        name: user?.displayName || "Sender",
        street1: selectedAddress.street1,
        street2: selectedAddress.street2 || "",
        city: selectedAddress.city,
        state: selectedAddress.state,
        zip: selectedAddress.zip,
        country: selectedAddress.country || "US",
        phone: selectedAddress.phone || "",
        email: user?.email || "",
      };

      // Get recipient's default address
      const recipientDefaultAddress = recipientShippingPreferences?.find(
        (addr) => addr.is_default
      );
      if (!recipientDefaultAddress) {
        console.log("No recipient address found");
        throw new Error("Recipient address not found");
      }

      // Prepare the recipient's address
      const toAddress = {
        name: otherUser.displayName || "Recipient",
        street1: recipientDefaultAddress.street1,
        street2: recipientDefaultAddress.street2 || "",
        city: recipientDefaultAddress.city,
        state: recipientDefaultAddress.state,
        zip: recipientDefaultAddress.zip,
        country: recipientDefaultAddress.country || "US",
        phone: recipientDefaultAddress.phone || "",
        email: otherUser?.email || "",
      };

      console.log("Creating shipping label with rate:", selectedRate.object_id);

      console.log("From address:", fromAddress);
      console.log("To address:", toAddress);

      // Create shipping label using the rate ID
      const labelResponse = await shippoService.createShippingLabel(
        selectedRate.object_id
      );

      console.log("Label response:", labelResponse);

      const updateData = {
        // status: "shipping_confirmed" as const,
        shipping_method: "mail" as const,
        carrier: labelResponse.rate?.provider || "USPS",
        label_url: labelResponse.label_url,
        updated_at: new Date().toISOString(),
        recipient_tracking_number: labelResponse.tracking_number,
        ...(isProposer
          ? {
              proposer_label_url: labelResponse.label_url,
              proposer_shipping_confirmed: true,
              // proposer_tracking_number: labelResponse.tracking_number,
            }
          : {
              recipient_label_url: labelResponse.label_url,
              recipient_shipping_confirmed: true,
              // recipient_tracking_number: labelResponse.tracking_number,
            }),
      };

      // Store label response and move to confirmation step
      setLabelResponse(labelResponse as unknown as LabelResponse);
      setStep("confirmation");

      console.log("Updating proposal with ID:", proposal.id);

      console.log("Update data:", updateData);

      updateProposal(proposal.id, updateData);
      updateShippingStatus(proposal.id, {
        status: "shipping_confirmed" as const,
        isProposer,
      });

      console.log("Proposal updated:", proposal);
    } catch (error) {
      console.error("Error in handleCreateLabel:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create shipping label";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedAddressId,
    user,
    otherUser,
    recipientShippingPreferences,
    shippingPreferences,
    proposal,
    isProposer,
    updateProposal,
    updateShippingStatus,
    selectedRate,
  ]);

  const handleSelectRate = (rate: ShippingRate) => {
    setSelectedRate(rate);
  };

  useEffect(() => {
    if (!isOpen) return;

    const defaultRecipientPref =
      recipientShippingPreferences?.find((p) => p.is_default) ||
      recipientShippingPreferences?.[0];
    const defaultUserPref =
      shippingPreferences?.find((p) => p.is_default) ||
      shippingPreferences?.[0];

    if (!defaultUserPref?.street1) {
      setError("Please add your shipping address first");
      setStep("address");
    } else if (!defaultRecipientPref?.street1) {
      setError(
        `${
          otherUser.displayName || "The recipient"
        } needs to add their shipping address`
      );
      setStep("check_recipient");
    } else if (
      defaultUserPref.street1 &&
      defaultRecipientPref.street1 &&
      defaultUserPref.city &&
      defaultRecipientPref.city &&
      defaultUserPref.state &&
      defaultUserPref.zip &&
      defaultRecipientPref.state &&
      defaultRecipientPref.zip
    ) {
      // Both addresses are set, proceed to rates
      setStep("rates");
      handleGetRates(defaultRecipientPref);
    } else {
      // Show address form with user's address pre-filled
      setStep("address");
    }
  }, [
    isOpen,
    recipientShippingPreferences,
    shippingPreferences,
    otherUser,
    handleGetRates,
  ]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop overlay - clicking closes the modal */}
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />

        {/* Modal container */}
        <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-medium">Shipping Information</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-4">
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                {error}
              </div>
            )}

            {/* Step-based content rendering */}
            {/* TODO: Implement the following step components */}

            {/* Step 1: Shipping Rates Selection */}
            {step === "rates" && (
              <div className="space-y-4">
                <h4 className="font-medium">Select Shipping Method</h4>

                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">
                      Loading shipping rates...
                    </p>
                  </div>
                ) : rates.length > 0 ? (
                  <>
                    {rates.map((rate) => (
                      <div
                        key={rate.object_id}
                        className={`p-4 border rounded cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedRate?.object_id === rate.object_id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200"
                        }`}
                        onClick={() => handleSelectRate(rate)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium">
                              {rate.servicelevel.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {rate.provider}
                            </div>
                            <div className="text-sm text-gray-500">
                              {rate.duration_terms}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold">
                              ${rate.amount}
                            </div>
                            <div className="text-sm text-gray-500">
                              {rate.estimated_days} business days
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {selectedRate && (
                      <button
                        onClick={() => setStep("confirm_shipping")}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium transition-colors"
                      >
                        Continue to Review
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-600">
                    <p>
                      No shipping rates available for the selected addresses.
                    </p>
                    <p className="text-sm mt-2">
                      Please check your address information and try again.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Shipping Confirmation */}
            {step === "confirm_shipping" && (
              <ShippingConfirmationStep
                selectedRate={selectedRate}
                senderAddress={shippingPreferences?.find(
                  (p) => p.id === selectedAddressId
                )}
                recipientAddress={
                  recipientShippingPreferences?.find((p) => p.is_default) ||
                  recipientShippingPreferences?.[0]
                }
                sender={user}
                recipient={otherUser}
                onBack={() => setStep("rates")}
                onCreateLabel={() => {
                  handleCreateLabel();
                }}
              />
            )}

            {/* Step 1: Address Selection */}
            {step === "address" && (
              <ShippingAddressStep
                shippingPreferences={shippingPreferences}
                selectedAddressId={selectedAddressId}
                onAddressSelect={setSelectedAddressId}
                onBack={onClose}
                onContinue={() => {
                  const defaultRecipientPref =
                    recipientShippingPreferences?.find((p) => p.is_default) ||
                    recipientShippingPreferences?.[0];
                  if (defaultRecipientPref?.street1) {
                    setStep("rates");
                    handleGetRates(defaultRecipientPref);
                  } else {
                    setStep("check_recipient");
                  }
                }}
              />
            )}

            {/* Step 2: Check Recipient Address */}
            {step === "check_recipient" && (
              <ShippingCheckRecipientStep
                recipientShippingPreferences={recipientShippingPreferences}
                recipient={otherUser}
                onBack={() => setStep("address")}
              />
            )}

            {/* Step 3: Confirmation */}
            {step === "confirmation" && labelResponse && (
              <ShippingLabelConfirmationStep
                labelResponse={labelResponse}
                onClose={onClose}
                proposal={proposal}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Address Step
interface ShippingAddressStepProps {
  shippingPreferences: ShippingPreference[];
  selectedAddressId: string;
  onAddressSelect: (addressId: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

const ShippingAddressStep = ({
  shippingPreferences,
  selectedAddressId,
  onAddressSelect,
  onBack,
  onContinue,
}: ShippingAddressStepProps) => {
  const hasValidAddress = shippingPreferences.some(
    (pref) => pref.street1 && pref.city && pref.state && pref.zip
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h4 className="text-xl font-semibold text-gray-900 mb-2">
          Select Shipping Address
        </h4>
        <p className="text-gray-600">
          Choose the address you'll be shipping from
        </p>
      </div>

      {shippingPreferences.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-gray-400" />
          </div>
          <h5 className="text-lg font-medium text-gray-900 mb-2">
            No Shipping Addresses Found
          </h5>
          <p className="text-gray-600 mb-4">
            You need to add a shipping address to your profile before you can
            ship items.
          </p>
          <button
            onClick={onBack}
            className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Go to Profile
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {shippingPreferences.map((address) => (
              <div
                key={address.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedAddressId === address.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
                onClick={() => onAddressSelect(address.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h5 className="font-medium text-gray-900">
                        {address.address_name || "Shipping Address"}
                      </h5>
                      {address.is_default && (
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-gray-700">
                      <p>{address.street1}</p>
                      {address.street2 && <p>{address.street2}</p>}
                      <p>
                        {address.city}, {address.state} {address.zip}
                      </p>
                      <p>{address.country}</p>
                      {address.phone && <p>{address.phone}</p>}
                    </div>
                  </div>
                  <div className="ml-4">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedAddressId === address.id
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300"
                      }`}
                    >
                      {selectedAddressId === address.id && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={onBack}
              className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 font-medium transition-colors"
            >
              Back
            </button>
            <button
              onClick={onContinue}
              disabled={!selectedAddressId || !hasValidAddress}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// Check Recipient Step
interface ShippingCheckRecipientStepProps {
  recipientShippingPreferences: ShippingPreference[];
  recipient: User;
  onBack: () => void;
}

const ShippingCheckRecipientStep = ({
  recipientShippingPreferences,
  recipient,
  onBack,
}: ShippingCheckRecipientStepProps) => {
  const hasValidRecipientAddress = recipientShippingPreferences.some(
    (pref) => pref.street1 && pref.city && pref.state && pref.zip
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h4 className="text-xl font-semibold text-gray-900 mb-2">
          Recipient Address Required
        </h4>
        <p className="text-gray-600">
          {recipient.displayName || "The recipient"} needs to add their shipping
          address
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h5 className="text-sm font-medium text-amber-800 mb-2">
              Action Required
            </h5>
            <div className="text-sm text-amber-700">
              <p>
                {recipient.displayName || "The recipient"} must add their
                shipping address to their profile before you can proceed with
                shipping.
              </p>
            </div>
          </div>
        </div>
      </div>

      {recipientShippingPreferences.length > 0 && !hasValidRecipientAddress && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-2">Current Addresses</h5>
          <div className="space-y-2">
            {recipientShippingPreferences.map((address) => (
              <div key={address.id} className="text-sm text-gray-600">
                <p>{address.street1}</p>
                {address.street2 && <p>{address.street2}</p>}
                <p>
                  {address.city}, {address.state} {address.zip}
                </p>
                <p>{address.country}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">i</span>
            </div>
          </div>
          <div className="ml-3">
            <h5 className="text-sm font-medium text-blue-800 mb-2">
              What happens next?
            </h5>
            <div className="text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>
                  You'll need to wait for{" "}
                  {recipient.displayName || "the recipient"} to add their
                  address
                </li>
                <li>
                  Once they add their address, you can return here to continue
                </li>
                <li>You'll receive a notification when they're ready</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onBack}
        className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 font-medium transition-colors"
      >
        Back
      </button>
    </div>
  );
};

// Confirm Shipping Step
interface ShippingConfirmationStepProps {
  selectedRate: ShippingRate | null;
  senderAddress: ShippingPreference | undefined;
  recipientAddress: ShippingPreference | undefined;
  sender: User;
  recipient: User;
  onBack: () => void;
  onCreateLabel: () => void;
}

const ShippingConfirmationStep = ({
  selectedRate,
  senderAddress,
  recipientAddress,
  sender,
  recipient,
  onBack,
  onCreateLabel,
}: ShippingConfirmationStepProps) => {
  if (!selectedRate || !senderAddress || !recipientAddress) {
    return (
      <div className="text-center py-8 text-gray-600">
        <p>Missing shipping information. Please go back and try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h4 className="text-xl font-semibold text-gray-900 mb-2">
          Confirm Shipping Details
        </h4>
        <p className="text-gray-600">
          Please review your shipping information before proceeding
        </p>
      </div>

      {/* Shipping Rate Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-medium text-blue-900">
              Selected Shipping Method
            </h5>
            <p className="text-blue-700">{selectedRate.servicelevel.name}</p>
            <p className="text-sm text-blue-600">
              {selectedRate.provider} • {selectedRate.duration_terms}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-900">
              ${selectedRate.amount}
            </div>
            <div className="text-sm text-blue-600">
              {selectedRate.estimated_days} business days
            </div>
          </div>
        </div>
      </div>

      {/* Addresses Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sender Address */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-green-600 font-semibold text-sm">From</span>
            </div>
            <h5 className="font-medium text-gray-900">Sender Address</h5>
          </div>
          <div className="space-y-1 text-sm text-gray-700">
            <p className="font-medium">{sender.displayName || "Sender"}</p>
            <p>{senderAddress.street1}</p>
            {senderAddress.street2 && <p>{senderAddress.street2}</p>}
            <p>
              {senderAddress.city}, {senderAddress.state} {senderAddress.zip}
            </p>
            <p>{senderAddress.country}</p>
            {senderAddress.phone && <p>{senderAddress.phone}</p>}
            {sender.email && <p>{sender.email}</p>}
          </div>
        </div>

        {/* Recipient Address */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-blue-600 font-semibold text-sm">To</span>
            </div>
            <h5 className="font-medium text-gray-900">Recipient Address</h5>
          </div>
          <div className="space-y-1 text-sm text-gray-700">
            <p className="font-medium">
              {recipient.displayName || "Recipient"}
            </p>
            <p>{recipientAddress.street1}</p>
            {recipientAddress.street2 && <p>{recipientAddress.street2}</p>}
            <p>
              {recipientAddress.city}, {recipientAddress.state}{" "}
              {recipientAddress.zip}
            </p>
            <p>{recipientAddress.country}</p>
            {recipientAddress.phone && <p> {recipientAddress.phone}</p>}
            {recipient.email && <p>{recipient.email}</p>}
          </div>
        </div>
      </div>

      {/* Important Notes */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-amber-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h5 className="text-sm font-medium text-amber-800">
              Important Notes
            </h5>
            <div className="mt-2 text-sm text-amber-700">
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Please ensure the package is properly packaged and labeled
                </li>
                <li>Include a return address on the package</li>
                <li>Keep tracking information for your records</li>
                <li>Ship within 24 hours of creating the label</li>
                <li>Contact support if you encounter any issues</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 font-medium transition-colors"
        >
          Back to Rates
        </button>
        <button
          onClick={onCreateLabel}
          className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 font-medium transition-colors"
        >
          Create Shipping Label
        </button>
      </div>
    </div>
  );
};

// Label Confirmation Step
interface ShippingLabelConfirmationStepProps {
  labelResponse: LabelResponse;
  onClose: () => void;
  proposal: TradeProposal;
}

const ShippingLabelConfirmationStep = ({
  labelResponse,
  onClose,
  proposal,
}: ShippingLabelConfirmationStepProps) => {
  const handleDownloadLabel = () => {
    if (labelResponse.label_url) {
      window.open(labelResponse.label_url, "_blank");
    }
  };

  const handleTrackPackage = () => {
    if (labelResponse.tracking_url_provider) {
      window.open(labelResponse.tracking_url_provider, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h4 className="text-xl font-semibold text-gray-900 mb-2">
          Shipping Label Created Successfully!
        </h4>
        <p className="text-gray-600">
          Your shipping label has been generated and is ready for download.
        </p>
      </div>

      {/* Label Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <Package className="h-5 w-5 text-blue-600 mr-2" />
          <h5 className="font-medium text-blue-900">Shipping Label Details</h5>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-700">Tracking Number:</span>
            <span className="font-mono text-blue-900">
              {proposal.proposer_shipping_confirmed
                ? proposal.proposer_tracking_number
                : proposal.recipient_tracking_number}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Status:</span>
            <span className="text-blue-900 capitalize">
              {proposal.proposer_shipping_confirmed
                ? "Proposer Confirmed"
                : "Recipient Confirmed"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Label ID:</span>
            <span className="font-mono text-blue-900">
              {labelResponse.object_id}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={handleDownloadLabel}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center"
        >
          <Download className="h-5 w-5 mr-2" />
          Download Shipping Label
        </button>

        <button
          onClick={handleTrackPackage}
          className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 font-medium transition-colors flex items-center justify-center"
        >
          <ExternalLink className="h-5 w-5 mr-2" />
          Track Package
        </button>
      </div>

      {/* Important Notes */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h5 className="text-sm font-medium text-amber-800 mb-2">
              Important Notes
            </h5>
            <div className="text-sm text-amber-700 space-y-1">
              <p>• Print the shipping label and attach it to your package</p>
              <p>• Ship your package within 24 hours of creating the label</p>
              <p>• Keep the tracking number for your records</p>
              <p>• Ensure the package is properly packaged and sealed</p>
              <p>• Contact support if you encounter any issues</p>
            </div>
          </div>
        </div>
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 font-medium transition-colors"
      >
        Close
      </button>
    </div>
  );
};






