import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types';
import { api } from '../services/api';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; confirm_password?: string }) => Promise<void>;
  setSession: (accessToken: string, user: User) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('zyrocloud_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('zyrocloud_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      if (token) {
        try {
          const freshUser = await api.getMe();
          setUser(freshUser);
          localStorage.setItem('zyrocloud_user', JSON.stringify(freshUser));
        } catch (err) {
          localStorage.removeItem('zyrocloud_token');
          localStorage.removeItem('zyrocloud_user');
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    verifySession();
  }, [token]);

  const login = async (username: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(username, pass);
      localStorage.setItem('zyrocloud_token', res.access_token);
      localStorage.setItem('zyrocloud_user', JSON.stringify(res.user));
      setToken(res.access_token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { username: string; email: string; password: string; confirm_password?: string }) => {
    setIsLoading(true);
    try {
      const res = await api.register(data);
      localStorage.setItem('zyrocloud_token', res.access_token);
      localStorage.setItem('zyrocloud_user', JSON.stringify(res.user));
      setToken(res.access_token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const setSession = (accessToken: string, newUser: User) => {
    localStorage.setItem('zyrocloud_token', accessToken);
    localStorage.setItem('zyrocloud_user', JSON.stringify(newUser));
    setToken(accessToken);
    setUser(newUser);
  };

  const logout = async () => {
    try {
      if (token) {
        await api.logout().catch(() => {});
      }
    } finally {
      localStorage.removeItem('zyrocloud_token');
      localStorage.removeItem('zyrocloud_user');
      setUser(null);
      setToken(null);
    }
  };

  const refreshUser = async () => {
    if (token) {
      const freshUser = await api.getMe();
      setUser(freshUser);
      localStorage.setItem('zyrocloud_user', JSON.stringify(freshUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        setSession,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
