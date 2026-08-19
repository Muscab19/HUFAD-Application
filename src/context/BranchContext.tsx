import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Branch, BranchState } from '../types/branch.types';
import { storage } from '../utils/storage';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const initialState: BranchState = {
  currentBranch: null,
  branches: [],
  isLoading: true,
  error: null,
};

interface BranchContextType extends BranchState {
  setBranch: (branchId: string) => Promise<void>;
  clearBranch: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  loadBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BranchState>(initialState);
  const { user } = useAuth();

  // Load stored branch data on mount
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const [branchId, branchData] = await Promise.all([
          storage.getBranchId(),
          storage.getBranchData(),
        ]);

        if (branchData) {
          setState({
            currentBranch: branchData,
            branches: [branchData],
            isLoading: false,
            error: null,
          });
        } else if (user?.branchId) {
          // If user has a branch ID but no stored branch, load it
          await loadBranches();
        } else {
          setState({
            ...initialState,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Error loading branch data:', error);
        setState({
          ...initialState,
          isLoading: false,
        });
      }
    };

    loadStoredData();
  }, [user]);

  const loadBranches = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // If user has a branchId, use it
      if (user?.branchId) {
        // Try to get branch name from user object or use default
        const branchName = (user as any)?.branchName || 'My Branch';
        const branchCode = (user as any)?.branchCode || 'BRANCH';
        
        const branch: Branch = {
          _id: user.branchId,
          tenantId: user.tenantId,
          name: branchName,
          code: branchCode,
          address: { street: '', city: '', state: '', zipCode: '' },
          contact: { phone: '', email: '' },
          status: 'active',
          isMainBranch: true,
          attendanceSettings: {
            enabled: true,
            attendanceCount: 1,
            slots: [{ slotNumber: 1, name: 'Regular Session', startTime: '09:00', endTime: '12:00', isActive: true }],
            defaultSlots: true,
            allowOverlap: false,
            requireCheckIn: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await storage.storeBranchId(branch._id);
        await storage.storeBranchData(branch);

        setState({
          currentBranch: branch,
          branches: [branch],
          isLoading: false,
          error: null,
        });
        return;
      }

      // For admin users, fetch branches from API
      if (user?.role === 'admin' || user?.role === 'school_admin') {
        try {
          const response = await api.get<Branch[]>('/api/admin/branches');
          const branches = response || [];

          if (branches.length > 0) {
            const currentBranch = branches[0];
            await storage.storeBranchId(currentBranch._id);
            await storage.storeBranchData(currentBranch);

            setState({
              currentBranch,
              branches,
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
          console.error('Failed to load branches:', error);
          setState({
            ...initialState,
            isLoading: false,
            error: 'Failed to load branches',
          });
        }
      } else {
        setState({
          ...initialState,
          isLoading: false,
        });
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load branches',
      }));
    }
  }, [user]);

  const setBranch = useCallback(async (branchId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const branch = state.branches.find(b => b._id === branchId);
      if (!branch) {
        throw new Error('Branch not found');
      }

      await storage.storeBranchId(branchId);
      await storage.storeBranchData(branch);

      setState(prev => ({
        ...prev,
        currentBranch: branch,
        isLoading: false,
        error: null,
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to set branch',
      }));
      throw error;
    }
  }, [state.branches]);

  const clearBranch = useCallback(async () => {
    await storage.clearTenant(); // This clears branch too
    setState({
      currentBranch: null,
      branches: [],
      isLoading: false,
      error: null,
    });
  }, []);

  const refreshBranches = useCallback(async () => {
    await loadBranches();
  }, [loadBranches]);

  return (
    <BranchContext.Provider
      value={{
        ...state,
        setBranch,
        clearBranch,
        refreshBranches,
        loadBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = (): BranchContextType => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};