import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { authAPI, setOnUnauthorized, sessionAPI } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedVersion, setFeedVersion] = useState(0);

  const loadUser = useCallback(async (storedToken) => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data.user);
      setToken(storedToken);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      loadUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, [loadUser]);

  const login = useCallback(async (credentials) => {
    const response = await authAPI.login(credentials);
    const data = response.data;

    if (data.requiresOtp) {
      return data;
    }

    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setToken(data.token);
      setFeedVersion((v) => v + 1);
    }
    return data;
  }, []);

  const verifyLoginOtp = useCallback(async (data) => {
    const response = await authAPI.verifyLoginOtp(data);
    const { user: userData, token: newToken } = response.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setToken(newToken);
    setFeedVersion((v) => v + 1);
    return userData;
  }, []);

  const register = useCallback(async (data) => {
    const response = await authAPI.register(data);
    const { user: userData, token: newToken } = response.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setToken(newToken);
    setFeedVersion((v) => v + 1);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await sessionAPI.logout();
    } catch {
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    router.push('/');
  }, [router]);

  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      setToken(null);
      router.push('/login');
    });
  }, [router]);

  const updateUser = useCallback((updates) => {
    setUser((prev) => ({ ...prev, ...updates }));
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    localStorage.setItem('user', JSON.stringify({ ...stored, ...updates }));
  }, []);

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    feedVersion,
    login,
    verifyLoginOtp,
    register,
    logout,
    updateUser,
    refreshUser: () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) loadUser(storedToken);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
