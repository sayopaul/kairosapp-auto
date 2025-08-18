import React from 'react';
import { Truck, Users, MapPin, Calendar, Clock, Check } from 'lucide-react';

interface ShippingMethodSelectorProps {
  onSelect: (method: 'mail' | 'local_meetup') => void;
  loading: boolean;
  onCancel: () => void;
}

const ShippingMethodSelector: React.FC<ShippingMethodSelectorProps> = ({
  onSelect,
  loading,
  onCancel,
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">How would you like to exchange cards?</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mail Option */}
        <div
          onClick={() => !loading && onSelect('mail')}
          className="bg-white rounded-xl p-6 shadow-lg border-2 border-blue-200 hover:border-blue-500 hover:shadow-xl transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Truck className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-gray-900">Mail Cards</h4>
              <p className="text-gray-600">Ship cards via postal service</p>
            </div>
          </div>
          
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5" />
              <span>Secure shipping with tracking</span>
            </div>
            <div className="flex items-start space-x-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5" />
              <span>No need to coordinate schedules</span>
            </div>
            <div className="flex items-start space-x-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5" />
              <span>Trade with anyone, anywhere</span>
            </div>
            <div className="flex items-start space-x-2">
              <Clock className="h-4 w-4 text-blue-500 mt-0.5" />
              <span>Typically 2-5 business days</span>
            </div>
          </div>
        </div>

        {/* Local Meetup Option */}
        <div
          onClick={() => !loading && onSelect('local_meetup')}
          className="bg-white rounded-xl p-6 shadow-lg border-2 border-green-200 hover:border-green-500 hover:shadow-xl transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Users className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-gray-900">Local Meetup</h4>
              <p className="text-gray-600">Meet in person to exchange cards</p>
            </div>
          </div>
          
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5" />
              <span>No shipping costs</span>
            </div>
            <div className="flex items-start space-x-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5" />
              <span>Inspect cards in person</span>
            </div>
            <div className="flex items-start space-x-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5" />
              <span>Meet fellow collectors</span>
            </div>
            <div className="flex items-start space-x-2">
              <MapPin className="h-4 w-4 text-green-500 mt-0.5" />
              <span>Choose a safe, public location</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <div className="flex items-start space-x-3">
          <Calendar className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-900">Important Note</h4>
            <p className="text-sm text-yellow-800 mt-1">
              Once you select a shipping method, you'll need to coordinate with the other trader to complete the exchange.
              For local meetups, we recommend using the chat feature to arrange details.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ShippingMethodSelector;