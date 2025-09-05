import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import Dashboard from "./components/Dashboard";
import Trades from "./components/Trades";
import Want from "./components/Want";
import Matches from "./components/Matches";
import Collection from "./components/Collection";
import Chat from "./components/Chat";
import Profile from "./components/Profile";
import TradeProposalTab from "./components/TradeProposalTab";
import TradeProposalNotification from "./components/TradeProposalNotification";
import AutoMatchingNotification from "./components/AutoMatchingNotification";
import Confirm from "./pages/Confirm";
import { NavigationTab } from "./types";
import { RefreshProvider } from "./contexts/RefreshContext";

function AppContent() {
  const [activeTab, setActiveTab] = useState<NavigationTab>("dashboard");

  const renderActiveComponent = () => {
    console.log("App: Rendering component for tab:", activeTab);
    switch (activeTab) {
      case "dashboard":
        return <Dashboard onTabChange={setActiveTab} />;
      case "trades":
        return <Trades />;
      case "want":
        return <Want />;
      case "matches":
        return <Matches onTabChange={setActiveTab} />;
      case "proposals":
        return <TradeProposalTab onTabChange={setActiveTab} />;
      case "collection":
        return <Collection />;
      case "chat":
        return <Chat />;
      case "profile":
        return <Profile />;
      default:
        return <Dashboard onTabChange={setActiveTab} />;
    }
  };

  return (
    <Routes>
      <Route path="/confirm" element={<Confirm />} />
      <Route path="/confirm/*" element={<Confirm />} />
      <Route
        path="/*"
        element={
          <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100">
            <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
            <main className="max-w-7xl mx-auto px-4 py-8">
              {renderActiveComponent()}
            </main>

            {/* Auto-matching notifications */}
            <AutoMatchingNotification onTabChange={setActiveTab} />

            {/* Trade proposal notifications */}
            <TradeProposalNotification />

            {/* Footer with Branding and Legal Links */}
            <footer className="bg-white border-t border-gray-200 mt-16">
              <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row items-center justify-between">
                  {/* Left Side: Logo and Tagline */}
                  <div className="flex items-center space-x-4 mb-4 md:mb-0">
                    <img
                      src="/logo.png"
                      alt="AutoTradeTCG Logo"
                      className="h-10"
                    />
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">
                        Your Collection. Your Rules. Our System.
                      </span>
                    </div>
                  </div>
                  {/* Right Side: Copyright and Links */}
                  <div className="flex flex-col md:items-end text-sm text-gray-400 space-y-1 md:space-y-0 md:space-x-4 md:flex-row">
                    <div>© 2024 AutoTradeTCG. All rights reserved.</div>
                    <div className="flex space-x-4">
                      <a
                        href="https://autotradetcg.github.io/AutoTradeTCG-Pages/support"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-500 underline"
                      >
                        Support
                      </a>
                      <a
                        href="https://autotradetcg.github.io/AutoTradeTCG-Pages/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-500 underline"
                      >
                        Privacy Policy
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <RefreshProvider>
      <AppContent />
    </RefreshProvider>
  );
}

export default App;
