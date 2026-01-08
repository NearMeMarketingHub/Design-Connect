// Contractor company types / internal roles
// These determine what features and access levels contractors have within the platform

export const CONTRACTOR_ROLES = [
  "Project Manager",
  "Lead Designer",
  "Electrician",
  "Plumber",
  "HVAC Technician",
  "Carpenter",
  "Roofer",
  "Painter",
  "Flooring Specialist",
  "Mason",
  "Landscaper",
  "Other"
] as const;

export type ContractorRole = typeof CONTRACTOR_ROLES[number];

// Role-based access configuration
// This defines the base structure for future permission implementation
export interface RolePermissions {
  canCreateProjects: boolean;
  canEditAllProjects: boolean;
  canViewAllProjects: boolean;
  canManageTeam: boolean;
  canAccessEstimator: boolean;
  canAccessInvoicing: boolean;
  canAccessBudgetManager: boolean;
  canInviteClients: boolean;
  canApproveContractors: boolean;
}

// Default permissions by role - to be implemented
// Currently all contractors have full access; this will be restricted later
export const ROLE_PERMISSIONS: Record<ContractorRole, RolePermissions> = {
  "Project Manager": {
    canCreateProjects: true,
    canEditAllProjects: true,
    canViewAllProjects: true,
    canManageTeam: true,
    canAccessEstimator: true,
    canAccessInvoicing: true,
    canAccessBudgetManager: true,
    canInviteClients: true,
    canApproveContractors: false,
  },
  "Lead Designer": {
    canCreateProjects: false,
    canEditAllProjects: false,
    canViewAllProjects: true,
    canManageTeam: false,
    canAccessEstimator: true,
    canAccessInvoicing: false,
    canAccessBudgetManager: false,
    canInviteClients: false,
    canApproveContractors: false,
  },
  "Electrician": {
    canCreateProjects: false,
    canEditAllProjects: false,
    canViewAllProjects: false,
    canManageTeam: false,
    canAccessEstimator: false,
    canAccessInvoicing: false,
    canAccessBudgetManager: false,
    canInviteClients: false,
    canApproveContractors: false,
  },
  "Plumber": {
    canCreateProjects: false,
    canEditAllProjects: false,
    canViewAllProjects: false,
    canManageTeam: false,
    canAccessEstimator: false,
    canAccessInvoicing: false,
    canAccessBudgetManager: false,
    canInviteClients: false,
    canApproveContractors: false,
  },
  "HVAC Technician": {
    canCreateProjects: false,
    canEditAllProjects: false,
    canViewAllProjects: false,
    canManageTeam: false,
    canAccessEstimator: false,
    canAccessInvoicing: false,
    canAccessBudgetManager: false,
    canInviteClients: false,
    canApproveContractors: false,
  },
  "Carpenter": {
    canCreateProjects: false,
    canEditAllProjects: false,
    canViewAllProjects: false,
    canManageTeam: false,
    canAccessEstimator: false,
    canAccessInvoicing: false,
    canAccessBudgetManager: false,
    canInviteClients: false,
    canApproveContractors: false,
  },
  "Roofer": {
    canCreateProjects: false,
    canEditAllProjects: false,
    canViewAllProjects: false,
    canManageTeam: false,
    canAccessEstimator: false,
    canAccessInvoicing: false,
    canAccessBudgetManager: false,
    canInviteClients: false,
    canApproveContractors: false,
  },
  "Painter": {
    canCreateProjects: false,
    canEditAllProjects: false,
    canViewAllProjects: false,
    canManageTeam: false,
    canAccessEstimator: false,
    canAccessInvoicing: false,
    canAccessBudgetManager: false,
    canInviteClients: false,
    canApproveContractors: false,
  },
  "Flooring Specialist": {
    canCreateProjects: false,
    canEditAllProjects: false,
    canViewAllProjects: false,
    canManageTeam: false,
    canAccessEstimator: false,
    canAccessInvoicing: false,
    canAccessBudgetManager: false,
    canInviteClients: false,
    canApproveContractors: false,
  },
  "Mason": {
    canCreateProjects: false,
    canEditAllProjects: false,
    canViewAllProjects: false,
    canManageTeam: false,
    canAccessEstimator: false,
    canAccessInvoicing: false,
    canAccessBudgetManager: false,
    canInviteClients: false,
    canApproveContractors: false,
  },
  "Landscaper": {
    canCreateProjects: false,
    canEditAllProjects: false,
    canViewAllProjects: false,
    canManageTeam: false,
    canAccessEstimator: false,
    canAccessInvoicing: false,
    canAccessBudgetManager: false,
    canInviteClients: false,
    canApproveContractors: false,
  },
  "Other": {
    canCreateProjects: false,
    canEditAllProjects: false,
    canViewAllProjects: false,
    canManageTeam: false,
    canAccessEstimator: false,
    canAccessInvoicing: false,
    canAccessBudgetManager: false,
    canInviteClients: false,
    canApproveContractors: false,
  },
};

// Default permissions for unknown/custom company types
// Falls back to "Other" permissions which are the most restrictive
const DEFAULT_PERMISSIONS: RolePermissions = ROLE_PERMISSIONS["Other"];

// Helper function to check if a company type is a known role
export function isKnownContractorRole(companyType: string | null | undefined): companyType is ContractorRole {
  if (!companyType) return false;
  return CONTRACTOR_ROLES.includes(companyType as ContractorRole);
}

// Helper function to check if a user has a specific permission
// Falls back to default (restrictive) permissions for unknown company types
export function hasPermission(
  companyType: string | null | undefined,
  permission: keyof RolePermissions
): boolean {
  if (!companyType) return false;
  
  // If known role, use its permissions
  if (isKnownContractorRole(companyType)) {
    return ROLE_PERMISSIONS[companyType][permission];
  }
  
  // Unknown/custom company type - use default (restrictive) permissions
  return DEFAULT_PERMISSIONS[permission];
}

// Helper function to get all permissions for a role
// Returns default permissions for unknown company types (never null for valid companyType)
export function getRolePermissions(companyType: string | null | undefined): RolePermissions | null {
  if (!companyType) return null;
  
  // If known role, use its permissions
  if (isKnownContractorRole(companyType)) {
    return ROLE_PERMISSIONS[companyType];
  }
  
  // Unknown/custom company type - use default (restrictive) permissions
  return DEFAULT_PERMISSIONS;
}
