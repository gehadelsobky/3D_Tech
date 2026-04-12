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
  'settings.backup',
  'api_keys.view',
  'api_keys.manage',
  'webhooks.view',
  'webhooks.manage',
  'files.upload',
  'files.delete',
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
    permissions: [
      { key: 'settings.smtp', label: 'SMTP Configuration' },
      { key: 'settings.backup', label: 'Backup & Restore' },
    ],
  },
  {
    label: 'Integrations',
    permissions: [
      { key: 'api_keys.view', label: 'View API Keys' },
      { key: 'api_keys.manage', label: 'Manage API Keys' },
      { key: 'webhooks.view', label: 'View Webhooks' },
      { key: 'webhooks.manage', label: 'Manage Webhooks' },
    ],
  },
  {
    label: 'Files',
    permissions: [
      { key: 'files.upload', label: 'Upload' },
      { key: 'files.delete', label: 'Delete' },
    ],
  },
];
