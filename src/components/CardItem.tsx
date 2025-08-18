import React from 'react';
import { Card } from '../types';
import { Trash2, Edit3 } from 'lucide-react';
import { JustTcgApiService } from '../services/justTcgApiService';

interface CardItemProps {
  card: Card;
  onRemove?: (cardId: string) => void;
  onEdit?: (card: Card) => void;
  showActions?: boolean;
}

const CardItem: React.FC<CardItemProps> = ({ 
  card, 
  onRemove, 
  onEdit, 
  showActions = true 
}) => {
  const [updatedPrice, setUpdatedPrice] = React.useState<number | null>(null);
  const [priceSource, setPriceSource] = React.useState<string>('database');
  const [priceLoading, setPriceLoading] = React.useState(false);

  // Try to get updated pricing from JustTCG on component mount
  // Disabled for now
  // React.useEffect(() => {
  //   const updatePricing = async () => {
  //     setPriceLoading(true);
  //     try {
  //       const pricing = await JustTcgApiService.updateCardPricing({
  //         name: card.name,
  //         set: card.set,
  //         condition: card.condition
  //       });
        
  //       if (pricing && pricing.price > 0) {
  //         setUpdatedPrice(pricing.price);
  //         setPriceSource('JustTCG');
  //       }
  //     } catch (error) {
  //       console.warn('Failed to update pricing for card:', card.name);
  //     } finally {
  //       setPriceLoading(false);
  //     }
  //   };

  //   updatePricing();
  // }, [card.name, card.set, card.condition]);

  const conditionColors = {
    'Mint': 'bg-blue-100 text-blue-800',
    'Near Mint': 'bg-gray-100 text-gray-800',
    'Lightly Played': 'bg-yellow-100 text-yellow-800',
    'Moderately Played': 'bg-orange-100 text-orange-800',
    'Heavily Played': 'bg-red-100 text-red-800',
    'Damaged': 'bg-gray-100 text-gray-800'
  };

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden border border-gray-100 hover:border-blue-200">
      {/* Full Card Image Display */}
      <div className="relative bg-gray-100 flex items-center justify-center p-4">
        <img
          src={card.image_url || 'https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2'}
          alt={card.name}
          className="w-full max-w-[200px] h-auto object-contain rounded-lg shadow-md"
          style={{ aspectRatio: '2.5/3.5' }} // Standard trading card ratio
        />
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg text-gray-900 truncate">{card.name}</h3>
          <div className="text-right">
            <span className="text-lg font-bold text-blue-600">
              ${(updatedPrice || card.market_price).toFixed(2)}
            </span>
            {updatedPrice && (
              <div className="text-xs text-green-600">
                {priceSource}
              </div>
            )}
            {priceLoading && (
              <div className="text-xs text-gray-500">
                Updating...
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Card #:</span>
            <span className="text-sm font-medium">{card.card_number}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Set:</span>
            <span className="text-sm font-medium truncate">{card.set}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Condition:</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${conditionColors[card.condition]}`}>
              {card.condition}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Quantity:</span>
            <span className="text-sm font-bold bg-gray-100 px-2 py-1 rounded">
              {card.quantity}
            </span>
          </div>
        </div>
        
        {showActions && (
          <div className="flex space-x-2">
            {onEdit && (
              <button
                onClick={() => onEdit(card)}
                className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors duration-200"
              >
                <Edit3 className="h-4 w-4" />
                <span className="text-sm font-medium">Edit</span>
              </button>
            )}
            {onRemove && (
              <button
                onClick={() => onRemove(card.id)}
                className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors duration-200"
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-sm font-medium">Remove</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CardItem;