"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authService } from '../services/authService';

interface User {
  id: number;
  username: string;
  email: string;
  balance: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = async () => {
    try {
      const res = await authService.getProfile();
      if (res.success) {
        setUser(res.data);
      } else {
        logout();
      }
    } catch (err) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
      if (pathname === '/dashboard') {
        router.push('/login');
      }
    }
  }, [pathname, router]);

  const login = async (data: any) => {
    const res = await authService.login(data);
    if (res.success) {
      localStorage.setItem('token', res.data.token);
      await fetchProfile();
      router.push('/dashboard');
    } else {
      throw new Error(res.message || 'Login failed');
    }
  };

  const register = async (data: any) => {
    const res = await authService.register(data);
    if (res.success) {
      localStorage.setItem('token', res.data.token);
      await fetchProfile();
      router.push('/dashboard');
    } else {
      throw new Error(res.message || 'Registration failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    router.push('/login');
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
