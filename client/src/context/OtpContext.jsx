import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useSocketContext } from './SocketContext';

const OtpContext = createContext(null);

export function OtpProvider({ children }) {
  const { socket } = useSocketContext();
  const [pendingOtp, setPendingOtp] = useState(null);
  const listenersRef = useRef({});

  useEffect(() => {
    if (!socket) return;

    const handler = (data) => {
      if (data && data.code) {
        setPendingOtp(data);
        Object.values(listenersRef.current).forEach((cb) => cb(data));
        setTimeout(() => setPendingOtp(null), 5000);
      }
    };

    socket.on('otp', handler);
    return () => socket.off('otp', handler);
  }, [socket]);

  const subscribe = useCallback((id, callback) => {
    listenersRef.current[id] = callback;
    return () => { delete listenersRef.current[id]; };
  }, []);

  return (
    <OtpContext.Provider value={{ pendingOtp, subscribe }}>
      {children}
    </OtpContext.Provider>
  );
}

export function useOtp() {
  const ctx = useContext(OtpContext);
  if (!ctx) {
    return { pendingOtp: null, subscribe: () => () => {} };
  }
  return ctx;
}
