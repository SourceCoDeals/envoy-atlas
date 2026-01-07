import React, { createContext, useContext, useState, useEffect } from 'react';

export type Channel = 'email' | 'calling';

interface ChannelContextType {
  channel: Channel;
  setChannel: (channel: Channel) => void;
}

const ChannelContext = createContext<ChannelContextType | undefined>(undefined);

export function ChannelProvider({ children }: { children: React.ReactNode }) {
  const [channel, setChannelState] = useState<Channel>(() => {
    const stored = localStorage.getItem('selectedChannel');
    return (stored === 'calling' ? 'calling' : 'email') as Channel;
  });

  const setChannel = (newChannel: Channel) => {
    setChannelState(newChannel);
    localStorage.setItem('selectedChannel', newChannel);
  };

  return (
    <ChannelContext.Provider value={{ channel, setChannel }}>
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannel() {
  const context = useContext(ChannelContext);
  if (!context) {
    throw new Error('useChannel must be used within a ChannelProvider');
  }
  return context;
}
