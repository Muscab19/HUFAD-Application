export interface Tenant {
  _id: string;
  schoolName: string;
  subdomain: string;
  adminUsername: string;
  adminEmail: string;
  status: 'pending' | 'active' | 'suspended';
  contactPerson?: string;
  phone?: string;
  location?: string;
  language?: 'eng' | 'som';
  numberOfStudents?: number;
  xalaqahNumber?: number;
  establishedYear?: number;
  createdAt: string;
  approvedAt?: string;
  suspensionReason?: string;
  suspendedAt?: string;
}

export interface TenantState {
  tenant: Tenant | null;
  tenantId: string | null;
  tenantSubdomain: string | null;
  isLoading: boolean;
  error: string | null;
}