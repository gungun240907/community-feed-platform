import { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import useSocket from '../hooks/useSocket';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const { addNotification, refresh } = useNotifications();

  const { socket, joinPost, leavePost } = useSocket(token, {
    onNotification: (data) => {
      if (data && data.notification) {
        addNotification(data.notification);
      }
    },
  });

  useEffect(() => {
    if (token) refresh();
  }, [token, refresh]);

  return (
    <SocketContext.Provider value={{ socket, joinPost, leavePost }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    return { socket: null, joinPost: () => {}, leavePost: () => {} };
  }
  return ctx;
}