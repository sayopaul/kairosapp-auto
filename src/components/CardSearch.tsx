import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, ExternalLink, Zap, X } from 'lucide-react';
import { CardSearchService, TransformedCard } from '../services/cardSearchService';

interface CardSearchProps {
  onCardSelect: (card: TransformedCard) => void;
  placeholder?: string;
  maxResults?: number;
}

const CardSearch: React.FC<CardSearchProps> = ({ 
  onCardSelect, 
  placeholder = "Card Name, Card Set, Condition (comma separated)",
  maxResults = 20
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TransformedCard[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showingAll, setShowingAll] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const suggestionDebounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchCards = async (searchQuery: string, getAllResults: boolean = false) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    console.log('🔍 CardSearch: Starting search for:', searchQuery);
    setIsLoading(true);
    setError(null);
    setShowSuggestions(false);

    try {
      const pageSize = getAllResults ? 250 : maxResults;
      const cards = await CardSearchService.searchCards(searchQuery, pageSize);
      console.log('✅ CardSearch: Received', cards.length, 'cards from all sources');
      setResults(cards);
      setShowResults(true);
      setSelectedIndex(-1);
      setShowingAll(getAllResults);
    } catch (err) {
      console.error('❌ CardSearch: Search failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to search cards. Please try again.';
      setError(errorMessage);
      setResults([]);
      setShowResults(false);
    } finally {
      setIsLoading(false);
    }
  };

  const formatSearchQuery = (input: string): string => {
    const [name = '', set = '', condition = ''] = input.split(',').map(item => item.trim());
    const parts = [];
    if (name) parts.push(`name:"${name}"`);
    if (set) parts.push(`set:"${set}"`);
    if (condition) parts.push(`condition:"${condition}"`);
    return parts.join(' ');
  };

  const getSuggestions = async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      let fq = formatSearchQuery(searchQuery)
      console.log('💡 CardSearch: Getting suggestions for:', fq);
      // For suggestions, we use a lightweight 10-result query
      const cards = await CardSearchService.searchCards(fq, 10);
      const cardNames = cards.slice(0, 6).map(card => card.name);
      const uniqueNames = [...new Set(cardNames)]; // Remove duplicates
      
      console.log('💡 CardSearch: Generated', uniqueNames.length, 'suggestions');
      setSuggestions(uniqueNames);
      setShowSuggestions(uniqueNames.length > 0 && !showResults);
    } catch (err) {
      console.error('❌ Error getting suggestions:', err);
      // Don't show error to user for suggestions, just fail silently  
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

 


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);
    setError(null); // Clear any previous errors
    setShowingAll(false); // Reset when typing

    // Clear previous debounces
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (suggestionDebounceRef.current) {
      clearTimeout(suggestionDebounceRef.current);
    }

    // If query is empty, clear everything
    if (!value.trim()) {
      setResults([]);
      setSuggestions([]);
      setShowResults(false);
      setShowSuggestions(false);
      return;
    }

    // Debounce suggestions (faster response)
    // suggestionDebounceRef.current = setTimeout(() => {
    //   getSuggestions(value);
    // }, 300);

    // Debounce full search (slower response)
    debounceRef.current = setTimeout(() => {
      const formattedQuery = formatSearchQuery(value);
      console.log("The formatted query from input change is: ", formattedQuery)
      searchCards(formattedQuery);
    }, 1000);
  };

  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = showSuggestions ? suggestions.length : results.length;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev <= 0 ? totalItems - 1 : prev - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0) {
        if (showSuggestions) {
          const selectedSuggestion = suggestions[selectedIndex];
          setQuery(selectedSuggestion);
          searchCards(selectedSuggestion);
        } else if (results.length > 0) {
          handleCardSelect(results[selectedIndex]);
        }
      } else if (query.trim()) {
        const formattedQuery = formatSearchQuery(query);
        console.log("The formatted query from search typing is: ", formattedQuery)
        searchCards(formattedQuery);
      }
    } else if (e.key === 'Escape') {
      setShowResults(false);
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    searchCards(suggestion);
    inputRef.current?.focus();
  };

  const handleCardSelect = (card: TransformedCard) => {
    onCardSelect(card);
    setQuery(card.name);
    setShowResults(false);
    setShowSuggestions(false);
  };

  const handleShowAllResults = () => {
    searchCards(query, true);
  };
  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setShowResults(false);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setShowingAll(false);
    inputRef.current?.focus();
  };

  const formatPrice = (price: number) => {
    return price > 0 ? `$${price.toFixed(2)}` : 'N/A';
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 font-semibold">{part}</span>
      ) : (
        part
      )
    );
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim()) {
              if (results.length > 0) {
                setShowResults(true);
              } else if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          autoComplete="off"
        />
        
        {/* Loading indicator */}
        {isLoading && (
          <Loader2 className="absolute right-10 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-500 animate-spin" />
        )}
        
        {/* Clear button */}
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <div className="p-2 border-b border-gray-100 bg-blue-50">
            <div className="flex items-center space-x-2 text-sm text-blue-700">
              <Zap className="h-4 w-4" />
              <span className="font-medium">Quick suggestions</span>
            </div>
          </div>
          
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors duration-200 ${
                selectedIndex === index ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="font-medium text-gray-900">
                {highlightMatch(suggestion, query)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Press Enter or click to search
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {error && (
            <div className="p-4 text-red-600 text-sm border-b border-gray-100 bg-red-50">
              <div className="flex items-center space-x-2">
                <ExternalLink className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          )}
          
          {results.length === 0 && !isLoading && !error && query.trim() && (
            <div className="p-4 text-gray-500 text-sm text-center">
              <div className="mb-2">No cards found for "{query}"</div>
              <div className="text-xs text-gray-400">
                Try a different spelling or partial name (e.g., "Char" for Charizard)
              </div>
            </div>
          )}

          {results.map((card, index) => (
            <button
              key={card.id}
              onClick={() => handleCardSelect(card)}
              className={`w-full p-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-left transition-colors duration-200 ${
                selectedIndex === index ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="flex items-center space-x-4">
                <img
                  src={card.image_url || 'https://images.pexels.com/photos/7708408/pexels-photo-7708408.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&dpr=2'}
                  alt={card.name}
                  className="w-12 h-16 object-cover rounded border shadow-sm"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 truncate">
                    {highlightMatch(card.name, query)}
                  </h4>
                  <p className="text-sm text-gray-600">
                    #{card.card_number} • {card.set}
                  </p>
                  <p className="text-sm text-gray-500">
                    {card.rarity}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-600">
                    ${card.market_price.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Market Price
                  </div>
                </div>
              </div>
            </button>
          ))}

          {/* Show All Results Button */}
          {results.length > 0 && !showingAll && results.length >= maxResults && (
            <div className="p-3 bg-gray-50 border-t border-gray-200">
              <button
                onClick={handleShowAllResults}
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading more...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    <span>Show All Results for "{query}"</span>
                  </>
                )}
              </button>
            </div>
          )}
          {results.length > 0 && (
            <div className="p-3 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <ExternalLink className="h-3 w-3" />
                  <span>Powered by Pokemon Price Tracker</span>
                </div>
                <div>
                  {results.length} result{results.length !== 1 ? 's' : ''} found{showingAll ? ' (all)' : ''}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CardSearch;