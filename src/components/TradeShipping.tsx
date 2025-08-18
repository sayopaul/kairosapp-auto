import React, { useState } from 'react';
import { Package, Truck, MapPin, ExternalLink, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import ShippingModal from './ShippingModal';

interface TradeShippingProps {
  tradeId: string;
  isUserTurn: boolean;
  recipientInfo: {
    name: string;
    email: string;
  };
  onShippingUpdate: (trackingNumber: string, carrier: string) => void;
  existingTracking?: {
    trackingNumber: string;
    carrier: string;
    status: string;
  };
}

const TradeShipping: React.FC<TradeShippingProps> = ({
  tradeId,
  isUserTurn,
  recipientInfo,
  onShippingUpdate,
  existingTracking
}) => {
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);

  const handleShippingComplete = async (trackingNumber: string, carrier: string) => {
    // Placeholder: Call your Supabase function to send the shipping label email
    try {
      await fetch('/api/sendShippingLabelEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId,
          recipient: recipientInfo,
          trackingNumber,
          carrier,
        }),
      });
    } catch (e) {
      // Optionally handle error or show notification
      console.error('Failed to send shipping label email', e);
    }
    onShippingUpdate(trackingNumber, carrier);
    setShippingError(null);
    // Do NOT close the modal here; let ShippingModal auto-close after 15s
  };


  const handleShippingError = (error: string) => {
    setShippingError(error);
  };

  const getCarrierTrackingUrl = (carrier: string, trackingNumber: string) => {
    const carrierUrls: { [key: string]: string } = {
      'usps': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
      'ups': `https://www.ups.com/track?tracknum=${trackingNumber}`,
      'fedex': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      'dhl': `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`,
    };
    
    return carrierUrls[carrier.toLowerCase()] || `https://www.google.com/search?q=${carrier}+tracking+${trackingNumber}`;
  };

  if (existingTracking) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-green-100 rounded-xl">
            <Package className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Package Shipped</h3>
            <p className="text-sm text-gray-600">Your package is on its way!</p>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Truck className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-900">{existingTracking.carrier.toUpperCase()}</span>
              </div>
              <div className="text-sm text-green-800">
                <div className="font-mono">{existingTracking.trackingNumber}</div>
                <div className="flex items-center space-x-1 mt-1">
                  <Clock className="h-3 w-3" />
                  <span>Status: {existingTracking.status}</span>
                </div>
              </div>
            </div>
            <a
              href={getCarrierTrackingUrl(existingTracking.carrier, existingTracking.trackingNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Track Package</span>
            </a>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4" />
            <span>Shipping to: {recipientInfo.name}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isUserTurn) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-gray-100 rounded-xl">
            <Package className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Waiting for Shipment</h3>
            <p className="text-sm text-gray-600">Waiting for the other trader to ship their package</p>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-2 text-gray-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm">You'll be notified when they create a shipping label</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-xl">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Ready to Ship</h3>
            <p className="text-sm text-gray-600">Create a shipping label for your trade package</p>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
          <div className="flex items-start space-x-3">
            <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Shipping to:</h4>
              <p className="text-blue-800">{recipientInfo.name}</p>
              <p className="text-sm text-blue-700">{recipientInfo.email}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setShowShippingModal(true)}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Truck className="h-5 w-5" />
            <span className="font-medium">Create Shipping Label</span>
          </button>

          <div className="text-xs text-gray-500 text-center">
            Powered by Shippo • Secure shipping with tracking
          </div>
        </div>

        <div className="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
          <h4 className="font-medium text-yellow-900 text-sm mb-2">Shipping Tips:</h4>
          <ul className="text-xs text-yellow-800 space-y-1">
            <li>• Use protective sleeves and rigid mailers for cards</li>
            <li>• Include a note with your username and trade details</li>
            <li>• Take photos of the package before shipping</li>
            <li>• Share tracking info in the trade chat</li>
          </ul>
        </div>
      </div>

      {shippingError && (
        <div className="mt-4 bg-red-50 p-3 rounded-lg border border-red-200">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900 text-sm">Shipping Error</h4>
              <p className="text-xs text-red-800">{shippingError}</p>
            </div>
          </div>
        </div>
      )}

      <ShippingModal
        isOpen={showShippingModal}
        onClose={() => setShowShippingModal(false)}
        tradeId={tradeId}
        recipientInfo={recipientInfo}
        onShippingComplete={handleShippingComplete}
        onShippingError={handleShippingError}
      />
    </>
  );
};

export default TradeShipping;