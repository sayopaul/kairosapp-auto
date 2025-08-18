import React, { useState, useEffect } from 'react';
import { Send, Paperclip, Archive, MessageCircle, Package, Truck, ExternalLink } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import TradeShipping from './TradeShipping';

interface ChatThread {
  id: string;
  match_id: string;
  other_user: {
    id: string;
    username: string;
    profile_image_url?: string;
  };
  last_message?: string;
  last_activity: string;
}

interface ChatMessage {
  id: string;
  match_id: string;
  sender_id: string;
  message: string;
  timestamp: string;
  card_image_url?: string;
}

const Chat: React.FC = () => {
  const { user } = useAuth();
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showShipping, setShowShipping] = useState(false);
  const [trackingInfo, setTrackingInfo] = useState<{
    trackingNumber: string;
    carrier: string;
    status?: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      fetchChatThreads();
    } else {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (selectedThread) {
      fetchMessages(selectedThread);
    }
  }, [selectedThread]);

  // Fetch tracking information for the selected thread
  useEffect(() => {
    if (selectedThread) {
      const fetchTrackingInfo = async () => {
        try {
          const { data, error } = await supabase
            .from('transactions')
            .select('tracking_number, carrier, tracking_status')
            .eq('match_id', selectedThread)
            .maybeSingle();
          
          if (error) throw error;
          
          if (data && data.tracking_number && data.carrier) {
            setTrackingInfo({
              trackingNumber: data.tracking_number,
              carrier: data.carrier,
              status: data.tracking_status || 'In Transit'
            });
          } else {
            setTrackingInfo(null);
          }
        } catch (error) {
          console.error('Error fetching tracking info:', error);
          setTrackingInfo(null);
        }
      };
      
      fetchTrackingInfo();
    }
  }, [selectedThread]);


  const fetchChatThreads = async () => {
    try {
      if (!user) return;

      // For demo user, show empty state
      if (user.id === 'demo-user-123') {
        setChatThreads([]);
        setLoading(false);
        return;
      }

      // Fetch matches where the user is involved
      const { data: matches, error } = await supabase
        .from('matches')
        .select(`
          id,
          user1_id,
          user2_id,
          created_at,
          user1:users!matches_user1_id_fkey(id, username, profile_image_url),
          user2:users!matches_user2_id_fkey(id, username, profile_image_url)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert matches to chat threads
      const threads: ChatThread[] = (matches || []).map(match => {
        const otherUser = match.user1_id === user.id ? match.user2 : match.user1;
        
        return {
          id: match.id,
          match_id: match.id,
          other_user: {
            id: otherUser?.id || '',
            username: otherUser?.username || 'Unknown User',
            profile_image_url: otherUser?.profile_image_url || undefined,
          },
          last_activity: match.created_at || new Date().toISOString(),
        };
      });

      setChatThreads(threads);
      
      // Auto-select first thread if available
      if (threads.length > 0 && !selectedThread) {
        setSelectedThread(threads[0].id);
      }
    } catch (error) {
      console.error('Error fetching chat threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (matchId: string) => {
    try {
      if (!user) return;

      // For demo user, show empty messages
      if (user.id === 'demo-user-123') {
        setMessages([]);
        return;
      }

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      const formattedMessages: ChatMessage[] = (data || []).map(msg => ({
        id: msg.id,
        match_id: msg.match_id,
        sender_id: msg.sender_id || '',
        message: msg.message || '',
        timestamp: msg.timestamp || new Date().toISOString(),
        card_image_url: msg.card_image_url || undefined,
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedThread || !user) return;

    try {
      // For demo user, just add message locally
      if (user.id === 'demo-user-123') {
        const demoMessage: ChatMessage = {
          id: Date.now().toString(),
          match_id: selectedThread,
          sender_id: user.id,
          message: newMessage,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, demoMessage]);
        setNewMessage('');
        return;
      }

      const { error } = await supabase
        .from('messages')
        .insert([{
          match_id: selectedThread,
          sender_id: user.id,
          message: newMessage,
          timestamp: new Date().toISOString(),
        }]);

      if (error) throw error;

      setNewMessage('');
      await fetchMessages(selectedThread);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleShippingUpdate = (trackingNumber: string, carrier: string) => {
    const shippingMessage: ChatMessage = {
      id: Date.now().toString(),
      match_id: selectedThread || '',
      sender_id: user?.id || '',
      message: `📦 Package shipped! Tracking: ${trackingNumber} via ${carrier.toUpperCase()}`,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, shippingMessage]);
    setShowShipping(false);

    setTrackingInfo({
      trackingNumber,
      carrier,
      status: 'Shipping Label Created'
    });
    
    // Update transaction with tracking info
    if (selectedThread && user) {
      supabase
        .from('transactions')
        .upsert({
          match_id: selectedThread,
          tracking_number: trackingNumber,
          carrier: carrier,
          tracking_status: 'Shipping Label Created',
          user1_sent: user.id === activeThread?.user1?.id,
          user2_sent: user.id === activeThread?.user2?.id
        })
        .then(({ error }) => {
          if (error) console.error('Error updating transaction:', error);
        });
    }
  };
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const activeThread = chatThreads.find(thread => thread.id === selectedThread);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 opacity-10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-2">
            <MessageCircle className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Trade Communications</h1>
          </div>
          <p className="text-gray-300 text-lg">Manage your trade conversations and shipping</p>
        </div>
      </div>

      <div className="h-[600px] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="flex h-full">
          {/* Thread List */}
          <div className="w-1/3 border-r border-gray-200 bg-gray-50">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-800 to-gray-900">
              <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
                <MessageCircle className="h-5 w-5" />
                <span>Trade Chats</span>
              </h2>
            </div>
            
            <div className="overflow-y-auto h-full">
              {chatThreads.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No active chats</h3>
                  <p className="text-gray-600">Start trading to begin conversations</p>
                </div>
              ) : (
                chatThreads.map(thread => {
                  const isSelected = selectedThread === thread.id;
                  
                  return (
                    <div
                      key={thread.id}
                      onClick={() => setSelectedThread(thread.id)}
                      className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-white transition-colors duration-200 ${
                        isSelected ? 'bg-white border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <img
                          src={thread.other_user.profile_image_url || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2'}
                          alt={thread.other_user.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{thread.other_user.username}</h3>
                          <p className="text-sm text-gray-600 truncate">
                            {thread.last_message || 'No messages yet'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatTime(thread.last_activity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedThread && activeThread ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <img
                        src={activeThread.other_user.profile_image_url || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2'}
                        alt={activeThread.other_user.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <h3 className="font-semibold text-gray-900">{activeThread.other_user.username}</h3>
                        <p className="text-sm text-gray-600">Online now</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => setShowShipping(!showShipping)}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                      >
                        <Package className="h-5 w-5" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                        <Archive className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Shipping Section */}
                {showShipping && (
                  <div className="p-4 bg-blue-50 border-b border-blue-200">
                    <TradeShipping
                      tradeId={selectedThread}
                      isUserTurn={true}
                      recipientInfo={{
                        name: activeThread.other_user.username,
                        email: 'trader@example.com'
                      }}
                      onShippingUpdate={handleShippingUpdate}
                      existingTracking={trackingInfo ? {
                        trackingNumber: trackingInfo.trackingNumber,
                        carrier: trackingInfo.carrier,
                        status: trackingInfo.status || 'In Transit'
                      } : undefined}
                    />
                  </div>
                )}
                
                {/* Tracking Information Banner */}
                {trackingInfo && !showShipping && (
                  <div className="p-4 bg-green-50 border-b border-green-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Truck className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-green-900">Package In Transit</h4>
                          <p className="text-sm text-green-700">
                            {trackingInfo.carrier.toUpperCase()}: {trackingInfo.trackingNumber}
                          </p>
                          <p className="text-xs text-green-600">
                            Status: {trackingInfo.status || 'In Transit'}
                          </p>
                        </div>
                      </div>
                      <a
                        href={`https://www.google.com/search?q=${trackingInfo.carrier}+tracking+${trackingInfo.trackingNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        <span>Track</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
                

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map(message => {
                      const isOwn = message.sender_id === user?.id;
                      
                      return (
                        <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            isOwn 
                              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white' 
                              : 'bg-white text-gray-900 border border-gray-200'
                          }`}>
                            <p>{message.message}</p>
                            <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                              {formatTime(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Trade Actions */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-t border-blue-200">
                  <div className="flex justify-center space-x-4">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
                      Accept Trade
                    </button>
                    <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200">
                      Modify Offer
                    </button>
                    <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200">
                      Decline Trade
                    </button>
                  </div>
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200 bg-white">
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                      <Paperclip className="h-5 w-5" />
                    </button>
                    
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    
                    <button
                      onClick={handleSendMessage}
                      className="p-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a conversation</h3>
                  <p className="text-gray-600">Choose a trade chat to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;