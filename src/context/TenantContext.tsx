import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Tenant, TenantState } from '../types/tenant.types';
import { storage } from '../utils/storage';
import { api } from '../api/client';

const initialState: TenantState = {
  tenant: null,
  tenantId: null,
  tenantSubdomain: null,
  isLoading: true,
  error: null,
};

interface TenantContextType extends TenantState {
  setTenant: (tenantId: string, subdomain: string) => Promise<void>;
  setTenantBySubdomain: (subdomain: string) => Promise<void>;
  clearTenant: () => Promise<void>;
  getTenantDetails: (tenantId: string) => Promise<Tenant>;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TenantState>(initialState);

  // Load stored tenant data on mount
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const [tenantId, tenantSubdomain] = await Promise.all([
          storage.getTenantId(),
          storage.getTenantSubdomain(),
        ]);

        if (tenantId) {
          // Try to get tenant details from API
          try {
            const tenant = await getTenantDetails(tenantId);
            setState({
              tenant,
              tenantId,
              tenantSubdomain: tenantSubdomain || tenant.subdomain,
              isLoading: false,
              error: null,
            });
          } catch (error) {
            // If tenant not found, clear storage
            await storage.clearTenant();
            setState({
              tenant: null,
              tenantId: null,
              tenantSubdomain: null,
              isLoading: false,
              error: 'Tenant not found',
            });
          }
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

    loadStoredData();
  }, []);

  const getTenantDetails = useCallback(async (tenantId: string): Promise<Tenant> => {
    try {
      // Use the super admin endpoint to get tenant details
      const response = await api.get<{ data: Tenant[] }>('/api/super/tenants');
      const tenants = response.data || [];
      const tenant = tenants.find((t: Tenant) => t._id === tenantId);
      
      if (!tenant) {
        throw new Error('Tenant not found');
      }
      return tenant;
    } catch (error) {
      console.error('Failed to get tenant details:', error);
      throw new Error('Failed to load tenant details');
    }
  }, []);

  const setTenant = useCallback(async (tenantId: string, subdomain: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const tenant = await getTenantDetails(tenantId);
      
      await Promise.all([
        storage.storeTenantId(tenantId),
        storage.storeTenantSubdomain(subdomain),
      ]);
      
      setState({
        tenant,
        tenantId,
        tenantSubdomain: subdomain,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to set tenant',
      }));
      throw error;
    }
  }, [getTenantDetails]);

  const setTenantBySubdomain = useCallback(async (subdomain: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      // Find tenant by subdomain using super admin endpoint
      const response = await api.get<{ data: Tenant[] }>('/api/super/tenants');
      const tenants = response.data || [];
      const tenant = tenants.find((t: Tenant) => t.subdomain === subdomain.toLowerCase());
      
      if (!tenant) {
        throw new Error(`School "${subdomain}" not found`);
      }
      
      await Promise.all([
        storage.storeTenantId(tenant._id),
        storage.storeTenantSubdomain(tenant.subdomain),
      ]);
      
      setState({
        tenant,
        tenantId: tenant._id,
        tenantSubdomain: tenant.subdomain,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'School not found',
      }));
      throw error;
    }
  }, []);

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
    if (!state.tenantId) return;
    
    try {
      const tenant = await getTenantDetails(state.tenantId);
      setState(prev => ({
        ...prev,
        tenant,
      }));
    } catch (error) {
      console.error('Failed to refresh tenant:', error);
    }
  }, [state.tenantId, getTenantDetails]);

  return (
    <TenantContext.Provider
      value={{
        ...state,
        setTenant,
        setTenantBySubdomain,
        clearTenant,
        getTenantDetails,
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