// Role definitions
export const ROLES = {
    CUSTOMER: 1,  // Changed from 'R1' to 1
    ADMIN: 2      // Changed from 'R2' to 2
};

// Role labels for display
export const ROLE_LABELS = {
    [ROLES.CUSTOMER]: 'Customer',
    [ROLES.ADMIN]: 'Administrator'
};

// Permissions for each role
export const PERMISSIONS = {
    [ROLES.CUSTOMER]: [
        'view_profile',
        'edit_profile',
        'make_purchases',
        'view_orders'
    ],
    [ROLES.ADMIN]: [
        'view_profile',
        'edit_profile',
        'manage_users',
        'view_analytics',
        'manage_products',
        'view_all_orders'
    ]
};
