// src/contexts/RefreshContext.tsx
import { createContext, useContext, useState } from 'react';

interface RefreshContextType {
  refreshTradeProposals: () => void;
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

export const RefreshProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshTradeProposals = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <RefreshContext.Provider value={{ refreshTradeProposals }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => {
  const context = useContext(RefreshContext);
  if (context === undefined) {
    throw new Error('useRefresh must be used within a RefreshProvider');
  }
  return context;
};