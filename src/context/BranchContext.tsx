// src/context/BranchContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Branch, BranchState } from '../types/branch.types';
import { storage } from '../utils/storage';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

// ============================================================
// CONSTANTS
// ============================================================
export const ALL_BRANCHES_ID = 'all-branches';

const allBranchesOption: Branch = {
  _id: ALL_BRANCHES_ID,
  tenantId: '',
  name: 'All Branches',
  code: 'ALL',
  address: { street: '', city: '', state: '', zipCode: '' },
  contact: { phone: '', email: '' },
  status: 'active',
  isMainBranch: false,
  // @ts-ignore — virtual flag; not part of the Branch schema but useful at runtime
  isAllBranches: true,
  attendanceSettings: {
    enabled: true,
    attendanceCount: 1,
    slots: [
      {
        slotNumber: 1,
        name: 'Regular Session',
        startTime: '09:00',
        endTime: '12:00',
        isActive: true,
      },
    ],
    defaultSlots: true,
    allowOverlap: false,
    requireCheckIn: false,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as Branch;

const initialState: BranchState = {
  currentBranch: null,
  branches: [],
  isLoading: true,
  error: null,
};

// ============================================================
// CONTEXT TYPE
// ============================================================
interface BranchContextType extends BranchState {
  setBranch: (branchId: string) => Promise<void>;
  /** Alias for setBranch — used by the profile screen */
  switchBranch: (branchId: string) => Promise<void>;
  clearBranch: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  loadBranches: () => Promise<void>;

  // Role-aware helpers (ported from the web BranchContext)
  canSwitchBranches: boolean;
  isBranchAdmin: boolean;
  isViewingAllBranches: boolean;
  userBranchId?: string;

  // Virtual option for reference
  allBranchesOption: Branch;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

// ============================================================
// HELPERS
// ============================================================
const isVirtualBranch = (branch: Branch | null | undefined): boolean => {
  return !!branch && (branch as any)._id === ALL_BRANCHES_ID;
};

/**
 * Build a minimal Branch object from a user object.
 * Used as an instant fallback so screens don't wait for the API.
 */
const buildBranchFromUser = (user: any): Branch | null => {
  if (!user?.branchId) return null;
  return {
    _id: user.branchId,
    tenantId: user.tenantId,
    name: user.branchName || user.schoolName || 'My Branch',
    code: user.branchCode || 'BRANCH',
    address: { street: '', city: '', state: '', zipCode: '' },
    contact: { phone: user.phone || '', email: user.email || '' },
    status: 'active',
    isMainBranch: true,
    attendanceSettings: {
      enabled: true,
      attendanceCount: 1,
      slots: [
        {
          slotNumber: 1,
          name: 'Regular Session',
          startTime: '09:00',
          endTime: '12:00',
          isActive: true,
        },
      ],
      defaultSlots: true,
      allowOverlap: false,
      requireCheckIn: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Branch;
};

const ADMIN_ROLES = ['admin', 'super_admin', 'school_admin'];
const isAdminRole = (role?: string) => !!role && ADMIN_ROLES.includes(role);

// ============================================================
// PROVIDER
// ============================================================
export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<BranchState>(initialState);
  const { user } = useAuth();

  // ============================================================
  // LOAD BRANCHES
  // ============================================================
  const loadBranches = useCallback(async () => {
    // ---------------------------------------------
    // 1) FAST PATH — user has a specific branchId
    // ---------------------------------------------
    const instantBranch = buildBranchFromUser(user);
    if (instantBranch) {
      await storage.storeBranchId(instantBranch._id);
      await storage.storeBranchData(instantBranch);
      setState({
        currentBranch: instantBranch,
        branches: [instantBranch],
        isLoading: false,
        error: null,
      });
      return;
    }

    // ---------------------------------------------
    // 2) SLOW PATH — admin/school_admin without branchId
    //    Fetch full branch list from API and preserve it.
    // ---------------------------------------------
    if (isAdminRole(user?.role)) {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));

        const response: any = await api.get('/admin/branches');
        const branches: Branch[] = Array.isArray(response)
          ? response
          : response?.branches || response?.data || [];

        if (branches.length > 0) {
          // Preserve the currently selected branch if it still exists
          const stillValid =
            state.currentBranch &&
            !isVirtualBranch(state.currentBranch) &&
            branches.some((b) => b._id === state.currentBranch!._id);

          // If viewing "All Branches", keep it
          const keepAll = isVirtualBranch(state.currentBranch);

          const nextCurrent = keepAll
            ? allBranchesOption
            : stillValid
            ? state.currentBranch
            : branches[0];

          // Persist only if it's a real branch
          if (nextCurrent && !isVirtualBranch(nextCurrent)) {
            await storage.storeBranchId(nextCurrent._id);
            await storage.storeBranchData(nextCurrent);
          } else {
            // Clear stored branch for "All Branches"
            await storage.clearBranch?.();
          }

          setState({
            currentBranch: nextCurrent,
            branches,
            isLoading: false,
            error: null,
          });
        } else {
          setState({
            currentBranch: null,
            branches: [],
            isLoading: false,
            error: 'No branches found for this account',
          });
        }
      } catch (error: any) {
        console.error('Failed to load branches:', error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error?.message || 'Failed to load branches',
        }));
      }
      return;
    }

    // ---------------------------------------------
    // 3) Nothing to load
    // ---------------------------------------------
    setState({
      currentBranch: null,
      branches: [],
      isLoading: false,
      error: null,
    });
  }, [user, state.currentBranch]);

  // ============================================================
  // BOOTSTRAP
  // ============================================================
  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Admin without a specific branchId must always fetch full list
        if (isAdminRole(user?.role) && !user?.branchId) {
          await loadBranches();
          return;
        }

        const [storedBranchId, storedBranchData] = await Promise.all([
          storage.getBranchId(),
          storage.getBranchData(),
        ]);

        // Case A: stored branch data exists (real branch)
        if (storedBranchData && storedBranchId) {
          setState({
            currentBranch: storedBranchData,
            branches: [storedBranchData],
            isLoading: false,
            error: null,
          });
          return;
        }

        // Case B: user has a branchId → synthesize instantly
        const instantBranch = buildBranchFromUser(user);
        if (instantBranch) {
          await storage.storeBranchId(instantBranch._id);
          await storage.storeBranchData(instantBranch);
          setState({
            currentBranch: instantBranch,
            branches: [instantBranch],
            isLoading: false,
            error: null,
          });
          return;
        }

        // Case C: no context
        setState({
          currentBranch: null,
          branches: [],
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error('Error loading branch data:', error);
        setState({
          currentBranch: null,
          branches: [],
          isLoading: false,
          error: null,
        });
      }
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(user as any)?.id ?? (user as any)?._id, (user as any)?.branchId]);

  // ============================================================
  // SET / SWITCH BRANCH
  // ============================================================
  const setBranch = useCallback(
    async (branchId: string) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));

        // Virtual "All Branches"
        if (branchId === ALL_BRANCHES_ID) {
          await storage.clearBranch?.();
          setState((prev) => ({
            ...prev,
            currentBranch: allBranchesOption,
            isLoading: false,
            error: null,
          }));
          return;
        }

        // Real branch — must exist in the current list
        const branch = state.branches.find((b) => b._id === branchId);
        if (!branch) throw new Error('Branch not found');

        await storage.storeBranchId(branchId);
        await storage.storeBranchData(branch);

        setState((prev) => ({
          ...prev,
          currentBranch: branch,
          isLoading: false,
          error: null,
        }));
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || 'Failed to set branch',
        }));
        throw error;
      }
    },
    [state.branches],
  );

  // ============================================================
  // CLEAR BRANCH
  // ============================================================
  const clearBranch = useCallback(async () => {
    await storage.clearTenant();
    setState({
      currentBranch: null,
      branches: [],
      isLoading: false,
      error: null,
    });
  }, []);

  // ============================================================
  // REFRESH
  // ============================================================
  const refreshBranches = useCallback(async () => {
    await loadBranches();
  }, [loadBranches]);

  // ============================================================
  // DERIVED (role-aware helpers)
  // ============================================================
  const isBranchAdmin = !!user?.branchId;
  const canSwitchBranches =
    isAdminRole(user?.role) && !user?.branchId && state.branches.length > 0;
  const isViewingAllBranches = isVirtualBranch(state.currentBranch);

  const value = useMemo<BranchContextType>(
    () => ({
      ...state,
      setBranch,
      switchBranch: setBranch, // alias
      clearBranch,
      refreshBranches,
      loadBranches,
      canSwitchBranches,
      isBranchAdmin,
      isViewingAllBranches,
      userBranchId: user?.branchId ?? undefined,
      allBranchesOption,
    }),
    [
      state,
      setBranch,
      clearBranch,
      refreshBranches,
      loadBranches,
      canSwitchBranches,
      isBranchAdmin,
      isViewingAllBranches,
      user?.branchId,
    ],
  );

  return (
    <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
  );
};

// ============================================================
// HOOK
// ============================================================
export const useBranch = (): BranchContextType => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};