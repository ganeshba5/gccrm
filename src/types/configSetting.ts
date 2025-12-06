import { Timestamp } from 'firebase/firestore';

export type ConfigScope = 'global' | 'user';
export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json' | 'array' | 'object';
export type ConfigKey = 'opportunities.view_history_from' | 'ui.theme' | 'notifications.email_enabled' | string; // Extend with specific keys

export interface ConfigSetting {
  id: string;
  key: ConfigKey;
  scope: ConfigScope;
  userId?: string; // Required if scope is 'user'
  value: any;
  valueType: ConfigValueType;
  description?: string;
  category?: string; // e.g., 'ui', 'email', 'opportunities'
  isEditable: boolean; // Can this setting be changed by users in the UI?
  defaultValue?: any; // Default value if not set
  validation?: {
    type: 'regex' | 'min' | 'max' | 'enum';
    pattern?: string;
    min?: number;
    max?: number;
    options?: string[];
  };
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

export type ConfigSettingFormData = Omit<ConfigSetting, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;

// Type-safe access for specific settings
export type TypedConfigSetting<T> = Omit<ConfigSetting, 'value'> & { value: T };

// Predefined config keys and their types/defaults
export const PREDEFINED_CONFIG_SETTINGS = {
  'opportunities.view_history_from': {
    defaultValue: new Date().getFullYear(), // Default to current year
    valueType: 'number' as ConfigValueType, // Can also be 'string' for a specific date
    description: 'Defines the earliest date from which opportunities should be visible. Can be a year (e.g., 2024) or a specific date (e.g., "2024-01-01"). Opportunities with an expected close date older than this will be hidden.',
    category: 'opportunities',
    isEditable: true,
  },
  'ui.theme': {
    defaultValue: 'light',
    valueType: 'string' as ConfigValueType,
    description: 'The theme of the user interface (light or dark).',
    category: 'ui',
    isEditable: true,
    validation: { type: 'enum', options: ['light', 'dark'] },
  },
  'notifications.email_enabled': {
    defaultValue: true,
    valueType: 'boolean' as ConfigValueType,
    description: 'Enable or disable email notifications.',
    category: 'notifications',
    isEditable: true,
  },
  // Add more predefined settings here
};

