export interface Branch {
  _id: string;
  tenantId: string;
  name: string;
  code: string;
  address: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  contact: {
    phone?: string;
    email?: string;
  };
  status: 'active' | 'inactive';
  isMainBranch: boolean;
  attendanceSettings: AttendanceSettings;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceSettings {
  enabled: boolean;
  attendanceCount: 1 | 2 | 3 | 4 | 5 | 6;
  slots: AttendanceSlot[];
  defaultSlots: boolean;
  allowOverlap: boolean;
  requireCheckIn: boolean;
}

export interface AttendanceSlot {
  slotNumber: number;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface BranchState {
  currentBranch: Branch | null;
  branches: Branch[];
  isLoading: boolean;
  error: string | null;
}