import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserMe, getMe, hasValidSession, clearTokens } from '../lib/api';

interface AuthContextType {
  user: UserMe | null;
  loading: boolean;
  login: (user: UserMe) => void;
  logout: () => void;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    if (!hasValidSession()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const userData = await getMe();
      setUser(userData);
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      setUser(null);
      clearTokens();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = (userData: UserMe) => {
    setUser(userData);
  };

  const logout = () => {
    setUser(null);
    clearTokens();
  };

  const refetchUser = async () => {
    // No cambiar el estado de loading para refetch
    try {
      const userData = await getMe();
      setUser(userData);
    } catch (error) {
      console.error('Error al refetch usuario:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
}
