import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || '';

export default function useSocket(token, handlers = {}) {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    socket.on('notification', (data) => {
      if (handlersRef.current.onNotification) {
        handlersRef.current.onNotification(data);
      }
    });

    socket.on('likeToggled', (data) => {
      if (handlersRef.current.onLikeToggled) {
        handlersRef.current.onLikeToggled(data);
      }
    });

    socket.on('accountSuspended', (data) => {
      if (handlersRef.current.onAccountSuspended) {
        handlersRef.current.onAccountSuspended(data);
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const joinPost = useCallback((postId) => {
    socketRef.current?.emit('joinPost', postId);
  }, []);

  const leavePost = useCallback((postId) => {
    socketRef.current?.emit('leavePost', postId);
  }, []);

  return {
    socket: socketRef.current,
    joinPost,
    leavePost,
  };
}
