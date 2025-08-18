import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle, X, Crown, Info, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCards } from '../hooks/useCards';
import { useSubscriptionLimits } from '../hooks/useSubscriptionLimits';
import { PokemonPriceTrackerApiService } from '../services/pokemonPriceTrackerApi';

interface CsvUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultListType?: 'trade' | 'want';
}

interface CsvRow {
  name: string;
  set?: string;
  card_number?: string;
  condition?: string;
  quantity?: number;
  list_type?: 'trade' | 'want';
  market_price?: number;
}

interface ProcessedCard extends CsvRow {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  image_url?: string;
  updated_price?: number;
}

const CsvUpload: React.FC<CsvUploadProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  defaultListType = 'trade' 
}) => {
  const { user } = useAuth();
  const { addCard } = useCards(user?.id);
  const { canUseFeature, currentTier } = useSubscriptionLimits(user?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [processedCards, setProcessedCards] = useState<ProcessedCard[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'processing' | 'complete'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const bulkUploadCheck = canUseFeature('canUseBulkUpload');

  const conditionOptions = ['Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged'];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
      setError('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
    parseCsvFile(selectedFile);
  };

  const parseCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setError('CSV file must contain at least a header row and one data row');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const requiredHeaders = ['name'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
          setError(`Missing required columns: ${missingHeaders.join(', ')}`);
          return;
        }

        const data: CsvRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row: CsvRow = { name: '' };

          headers.forEach((header, index) => {
            const value = values[index] || '';
            switch (header) {
              case 'name':
                row.name = value;
                break;
              case 'set':
                row.set = value;
                break;
              case 'card_number':
              case 'number':
                row.card_number = value;
                break;
              case 'condition':
                row.condition = conditionOptions.includes(value) ? value : 'Near Mint';
                break;
              case 'quantity':
                row.quantity = parseInt(value) || 1;
                break;
              case 'list_type':
              case 'type':
                row.list_type = (value === 'trade' || value === 'want') ? value : defaultListType;
                break;
              case 'market_price':
              case 'price':
                row.market_price = parseFloat(value) || undefined;
                break;
            }
          });

          if (row.name) {
            // Set defaults
            row.set = row.set || 'Unknown Set';
            row.condition = row.condition || 'Near Mint';
            row.quantity = row.quantity || 1;
            row.list_type = row.list_type || defaultListType;
            
            data.push(row);
          }
        }

        if (data.length === 0) {
          setError('No valid card data found in CSV file');
          return;
        }

        setCsvData(data);
        setCurrentStep('preview');
      } catch (error) {
        setError('Failed to parse CSV file. Please check the format.');
      }
    };

    reader.onerror = () => {
      setError('Failed to read file');
    };

    reader.readAsText(file);
  };

  const processCards = async () => {
    if (!user || csvData.length === 0) return;

    setIsProcessing(true);
    setCurrentStep('processing');
    setProgress({ current: 0, total: csvData.length });

    const processed: ProcessedCard[] = csvData.map((card, index) => ({
      ...card,
      id: `temp-${index}`,
      status: 'pending'
    }));

    setProcessedCards(processed);

    // Process cards in batches to avoid overwhelming the API
    const batchSize = 5;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < csvData.length; i += batchSize) {
      const batch = csvData.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (card, batchIndex) => {
          const cardIndex = i + batchIndex;
          
          try {
            // Update status to processing
            setProcessedCards(prev => prev.map((c, idx) => 
              idx === cardIndex ? { ...c, status: 'processing' } : c
            ));

            // Try to get updated pricing and image from Pokemon TCG API
            let updatedPrice = card.market_price || 0;
            let imageUrl = card.image_url || 'https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2';
            let set = card.set || 'Unknown Set';
            let cardNumber = card.card_number || '';
            let cardName = card.name;

            try {
              let sq = `name:"${card.name}" set:"${card.set}" card_number:"${card.card_number}" condition:"${card.condition}" "`
              console.log("The search query for CSV upload is: ", sq)
              const searchResults = await PokemonPriceTrackerApiService.searchCards(sq);
              if (searchResults.length > 0) {
                const foundCard = searchResults[0];
                updatedPrice = foundCard.market_price || updatedPrice;
                imageUrl = foundCard.image_url || imageUrl;
                set = foundCard.set || set;
                cardNumber = foundCard.card_number || cardNumber;
              }
            } catch (apiError) {
              console.warn('API lookup failed for card:', card.name, apiError);
            }

            // Add card to database
            const cardData = {
              user_id: user.id.toString(),
              name: cardName,
              set: set,
              card_number: cardNumber,
              condition: (card.condition as any) || 'Near Mint',
              quantity: Number(card.quantity) || 1,
              list_type: card.list_type || defaultListType,
              market_price: updatedPrice,
              image_url: imageUrl
            };


            await addCard(cardData);

            // Update status to success
            setProcessedCards(prev => prev.map((c, idx) => 
              idx === cardIndex ? { 
                ...c, 
                status: 'success', 
                updated_price: updatedPrice,
                image_url: imageUrl
              } : c
            ));

            successCount++;
          } catch (error) {
            console.error('Error processing card:', card.name, error);
            
            // Update status to error
            setProcessedCards(prev => prev.map((c, idx) => 
              idx === cardIndex ? { 
                ...c, 
                status: 'error', 
                error: error instanceof Error ? error.message : 'Unknown error'
              } : c
            ));

            errorCount++;
          }

          setProgress(prev => ({ ...prev, current: prev.current + 1 }));
        })
      );

      // Small delay between batches to be respectful to APIs
      if (i + batchSize < csvData.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setIsProcessing(false);
    setCurrentStep('complete');

    if (successCount > 0) {
      setTimeout(() => {
        onSuccess();
      }, 2000);
    }
  };

  const downloadTemplate = () => {
    const template = [
      'name,set,card_number,condition,quantity,list_type,market_price',
      'Charizard,Base Set,006,Near Mint,1,trade,350.00',
      'Pikachu,Base Set,025,Lightly Played,2,want,25.00',
      'Blastoise,Base Set,009,Near Mint,1,trade,280.00'
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pokemon_cards_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetUpload = () => {
    setFile(null);
    setCsvData([]);
    setProcessedCards([]);
    setCurrentStep('upload');
    setError(null);
    setProgress({ current: 0, total: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Upload className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">CSV Bulk Upload</h2>
                <p className="text-purple-100">Upload multiple Pokemon cards from a CSV file</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Subscription Check */}
          {!bulkUploadCheck.allowed && (
            <div className="mb-6 flex items-start space-x-3 p-4 rounded-lg border bg-orange-50 border-orange-200">
              <Crown className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-orange-900">{bulkUploadCheck.message}</h4>
                <p className="text-sm text-orange-800 mt-1">
                  Upgrade to Elite Trainer or Master Collector to unlock bulk CSV upload functionality.
                </p>
                <p className="text-xs text-orange-700 mt-2">
                  Current tier: <strong>{currentTier === 'trainer' ? 'Free' : currentTier === 'elite' ? 'Elite Trainer' : 'Master Collector'}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6 flex items-center space-x-3 p-4 rounded-lg border bg-red-50 border-red-200 text-red-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Step 1: Upload */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">CSV Format Requirements</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                  <div>
                    <h4 className="font-medium mb-2">Required Columns:</h4>
                    <ul className="space-y-1">
                      <li>• <code className="bg-blue-100 px-1 rounded">name</code> - Card name (required)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Optional Columns:</h4>
                    <ul className="space-y-1">
                      <li>• <code className="bg-blue-100 px-1 rounded">set</code> - Set name</li>
                      <li>• <code className="bg-blue-100 px-1 rounded">card_number</code> - Card number</li>
                      <li>• <code className="bg-blue-100 px-1 rounded">condition</code> - Card condition</li>
                      <li>• <code className="bg-blue-100 px-1 rounded">quantity</code> - Number of cards</li>
                      <li>• <code className="bg-blue-100 px-1 rounded">list_type</code> - 'trade' or 'want'</li>
                      <li>• <code className="bg-blue-100 px-1 rounded">market_price</code> - Price in USD</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">💡 Quick Test Cards:</h4>
                  <p className="text-sm text-blue-800">
                    Try adding popular cards like: <strong>Charizard, Pikachu, Blastoise, Venusaur, Mewtwo</strong>
                  </p>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={downloadTemplate}
                  className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  <Download className="h-5 w-5" />
                  <span>Download Template</span>
                </button>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors duration-200">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  disabled={!bulkUploadCheck.allowed}
                  className="hidden"
                />
                <div className="space-y-4">
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Upload CSV File</h3>
                    <p className="text-gray-600">Select a CSV file containing your Pokemon card data</p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!bulkUploadCheck.allowed}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Choose File
                  </button>
                  <p className="text-xs text-gray-500">Maximum file size: 5MB</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {currentStep === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Preview: {csvData.length} cards found
                </h3>
                <button
                  onClick={resetUpload}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Upload Different File
                </button>
              </div>

              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <div className="flex items-start space-x-3">
                  <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">Before processing:</p>
                    <ul className="mt-1 space-y-1">
                      <li>• Card prices will be updated from Pokemon TCG API when available</li>
                      <li>• High-quality images will be automatically assigned</li>
                      <li>• Missing information will be filled with defaults</li>
                      <li>• Processing may take a few minutes for large files</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-900">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-900">Set</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-900">Condition</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-900">Qty</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-900">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-900">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {csvData.slice(0, 50).map((card, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{card.name}</td>
                        <td className="px-4 py-3 text-gray-600">{card.set || 'Unknown Set'}</td>
                        <td className="px-4 py-3 text-gray-600">{card.condition || 'Near Mint'}</td>
                        <td className="px-4 py-3 text-gray-600">{card.quantity || 1}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            (card.list_type || defaultListType) === 'trade' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {card.list_type || defaultListType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {card.market_price ? `$${card.market_price.toFixed(2)}` : 'Auto-detect'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 50 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    ... and {csvData.length - 50} more cards
                  </div>
                )}
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={processCards}
                  disabled={!bulkUploadCheck.allowed}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Process {csvData.length} Cards
                </button>
                <button
                  onClick={resetUpload}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {currentStep === 'processing' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Processing Cards</h3>
                <p className="text-gray-600">
                  {progress.current} of {progress.total} cards processed
                </p>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {processedCards.map((card, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {card.status === 'pending' && (
                        <div className="w-5 h-5 bg-gray-300 rounded-full"></div>
                      )}
                      {card.status === 'processing' && (
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      )}
                      {card.status === 'success' && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                      {card.status === 'error' && (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{card.name}</div>
                      {card.status === 'error' && card.error && (
                        <div className="text-sm text-red-600">{card.error}</div>
                      )}
                      {card.status === 'success' && card.updated_price && (
                        <div className="text-sm text-green-600">
                          Price updated: ${card.updated_price.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 'complete' && (
            <div className="space-y-6 text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Complete!</h3>
                <div className="text-gray-600">
                  <p>Successfully processed: {processedCards.filter(c => c.status === 'success').length} cards</p>
                  {processedCards.filter(c => c.status === 'error').length > 0 && (
                    <p className="text-red-600">
                      Failed: {processedCards.filter(c => c.status === 'error').length} cards
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h4 className="font-medium text-green-900 mb-2">What's Next?</h4>
                <ul className="text-sm text-green-800 space-y-1 text-left">
                  <li>• Your cards have been added to your collection</li>
                  <li>• Prices were updated from Pokemon TCG API where available</li>
                  <li>• The auto-matching system will find potential trades</li>
                  <li>• Check the Matches tab to see new opportunities</li>
                </ul>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={resetUpload}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Upload More Cards
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CsvUpload;