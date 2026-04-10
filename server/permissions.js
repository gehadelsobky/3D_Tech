export const ALL_PERMISSIONS = [
  'products.view',
  'products.create',
  'products.edit',
  'products.delete',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'gift_settings.view',
  'gift_settings.edit',
  'roles.manage',
  'pages.view',
  'pages.edit',
  'forms.view',
  'forms.create',
  'forms.edit',
  'forms.delete',
  'settings.smtp',
];

// Grouped for the UI
export const PERMISSION_GROUPS = [
  {
    label: 'Products',
    permissions: [
      { key: 'products.view', label: 'View' },
      { key: 'products.create', label: 'Create' },
      { key: 'products.edit', label: 'Edit' },
      { key: 'products.delete', label: 'Delete' },
    ],
  },
  {
    label: 'Users',
    permissions: [
      { key: 'users.view', label: 'View' },
      { key: 'users.create', label: 'Create' },
      { key: 'users.edit', label: 'Edit' },
      { key: 'users.delete', label: 'Delete' },
    ],
  },
  {
    label: 'Gift Settings',
    permissions: [
      { key: 'gift_settings.view', label: 'View' },
      { key: 'gift_settings.edit', label: 'Edit' },
    ],
  },
  {
    label: 'Roles',
    permissions: [
      { key: 'roles.manage', label: 'Manage' },
    ],
  },
  {
    label: 'Pages',
    permissions: [
      { key: 'pages.view', label: 'View' },
      { key: 'pages.edit', label: 'Edit' },
    ],
  },
  {
    label: 'Forms',
    permissions: [
      { key: 'forms.view', label: 'View' },
      { key: 'forms.create', label: 'Create' },
      { key: 'forms.edit', label: 'Edit' },
      { key: 'forms.delete', label: 'Delete' },
    ],
  },
  {
    label: 'Settings',
    soon: true,
    permissions: [
      { key: 'settings.smtp', label: 'SMTP Configuration' },
    ],
  },
];
