import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TenantState } from '../types/tenant.types';
import { storage } from '../utils/storage';
import { useAuth } from './AuthContext';

const initialState: TenantState = {
  tenant: null,
  tenantId: null,
  tenantSubdomain: null,
  isLoading: true,
  error: null,
};

interface TenantContextType extends TenantState {
  clearTenant: () => Promise<void>;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TenantState>(initialState);
  const { user } = useAuth();

  // Load tenant data from storage whenever user changes (login/logout)
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const [tenantId, tenantSubdomain, tenantData] = await Promise.all([
          storage.getTenantId(),
          storage.getTenantSubdomain(),
          storage.getTenantData(),
        ]);

        if (tenantId) {
          setState({
            tenant: tenantData || {
              tenantId,
              subdomain: tenantSubdomain || '',
              schoolName: tenantData?.schoolName || 'Your School',
            } as any,
            tenantId,
            tenantSubdomain: tenantSubdomain || '',
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
        console.error('Error loading tenant data:', error);
        setState({
          ...initialState,
          isLoading: false,
        });
      }
    };

    loadTenant();
  }, [user?.tenantId]);

  const clearTenant = useCallback(async () => {
    await storage.clearTenant();
    setState({
      tenant: null,
      tenantId: null,
      tenantSubdomain: null,
      isLoading: false,
      error: null,
    });
  }, []);

  const refreshTenant = useCallback(async () => {
    const tenantData = await storage.getTenantData();
    if (tenantData) {
      setState(prev => ({
        ...prev,
        tenant: tenantData,
      }));
    }
  }, []);

  return (
    <TenantContext.Provider
      value={{
        ...state,
        clearTenant,
        refreshTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};