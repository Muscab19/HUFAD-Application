import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthState, User, LoginCredentials } from '../types/user.types';
import { authService } from '../api/services/authService';
import { storage } from '../utils/storage';
import { Alert } from 'react-native';

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
  error: null,
};

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);

  // Load stored auth data on mount
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const [token, user] = await Promise.all([
          storage.getToken(),
          storage.getUser(),
        ]);

        if (token && user) {
          setState({
            user,
            token,
            isLoading: false,
            error: null,
          });
        } else {
          setState({
            ...initialState,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
        setState({
          ...initialState,
          isLoading: false,
        });
      }
    };

    loadStoredData();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await authService.login(credentials);
      
      setState({
        user: response.user,
        token: response.token,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Login failed',
      }));
      
      Alert.alert('Login Failed', error.message || 'Please check your credentials');
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setState({
        user: null,
        token: null,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  const updateUser = useCallback(async (userData: Partial<User>) => {
    try {
      const updatedUser = await authService.updateProfile(userData);
      setState(prev => ({
        ...prev,
        user: updatedUser,
      }));
    } catch (error: any) {
      Alert.alert('Update Failed', error.message || 'Failed to update profile');
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        updateUser,
        clearError,
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