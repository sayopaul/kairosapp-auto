import React from 'react';
import { Truck, Users, MapPin, Clock, Check, MessageCircle, ArrowRight } from 'lucide-react';

interface ShippingMethodSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMail: () => void;
  onSelectMeetup: () => void;
  otherUser: {
    username: string;
  };
}

const ShippingMethodSelectionModal: React.FC<ShippingMethodSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectMail,
  onSelectMeetup,
  otherUser,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto transform transition-transform duration-300">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Choose Exchange Method
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                How would you like to exchange cards with {otherUser.username}?
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Mail Option */}
            <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-blue-200 hover:border-blue-500 hover:shadow-xl transition-all duration-200 cursor-pointer group"
                 onClick={onSelectMail}>
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-4 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors duration-200">
                  <Truck className="h-10 w-10 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-2xl font-semibold text-gray-900">Mail Exchange</h4>
                  <p className="text-gray-600">Ship cards via postal service</p>
                </div>
              </div>
              
              <div className="space-y-4 text-sm text-gray-600 mb-6">
                <div className="flex items-start space-x-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Secure shipping with tracking and insurance</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>No need to coordinate schedules</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Trade with anyone, anywhere</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>Typically 2-5 business days delivery</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Automated shipping label generation</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors duration-200">
                <span className="font-medium text-blue-900">Proceed to Shipping</span>
                <ArrowRight className="h-5 w-5 text-blue-600 group-hover:translate-x-1 transition-transform duration-200" />
              </div>
            </div>

            {/* Public Meetup Option */}
            <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-green-200 hover:border-green-500 hover:shadow-xl transition-all duration-200 cursor-pointer group"
                 onClick={onSelectMeetup}>
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-4 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors duration-200">
                  <Users className="h-10 w-10 text-green-600" />
                </div>
                <div>
                  <h4 className="text-2xl font-semibold text-gray-900">Public Meetup</h4>
                  <p className="text-gray-600">Meet in person to exchange cards</p>
                </div>
              </div>
              
              <div className="space-y-4 text-sm text-gray-600 mb-6">
                <div className="flex items-start space-x-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>No shipping costs or delays</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Inspect cards in person before exchange</span>
                </div>
                <div className="flex items-start space-x-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Meet fellow collectors in your area</span>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Choose a safe, public location</span>
                </div>
                <div className="flex items-start space-x-3">
                  <MessageCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Coordinate details via chat</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors duration-200">
                <span className="font-medium text-green-900">Open Chat to Coordinate</span>
                <MessageCircle className="h-5 w-5 text-green-600 group-hover:scale-110 transition-transform duration-200" />
              </div>
            </div>
          </div>

          {/* Safety Guidelines */}
          <div className="mt-8 bg-yellow-50 p-6 rounded-lg border border-yellow-200">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-yellow-900 mb-2">Safety Guidelines</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-800">
                  <div>
                    <h5 className="font-medium mb-1">For Mail Exchange:</h5>
                    <ul className="space-y-1">
                      <li>• Package cards securely with protective sleeves</li>
                      <li>• Use tracking and insurance for valuable cards</li>
                      <li>• Include a note with trade details</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium mb-1">For Public Meetup:</h5>
                    <ul className="space-y-1">
                      <li>• Always meet in a public place</li>
                      <li>• Consider meeting during daylight hours</li>
                      <li>• Let someone know where you're going</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShippingMethodSelectionModal;
