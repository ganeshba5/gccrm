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
  'email_parsing.show_routing_methods': {
    defaultValue: [], // Empty array = only show manual items (no routingMethod)
    valueType: 'array' as ConfigValueType,
    description: 'Controls which smart routing methods should be visible. Options: pattern, metadata, context. Items created by routing methods not in this list will be hidden. Empty array means only manual items are shown. Users can override this with their own user setting.',
    category: 'email_parsing',
    isEditable: true,
    validation: { 
      type: 'enum', 
      options: ['pattern', 'metadata', 'context'] 
    },
  },
  'email_parsing.apply_routing_methods': {
    defaultValue: ['pattern'], // Default: only pattern matching creates objects
    valueType: 'array' as ConfigValueType,
    description: 'Controls which routing methods are allowed to create accounts/opportunities. Options: pattern, metadata, context. Explicit pattern matching (Account:, Opportunity:) is always allowed. This setting controls metadata and context-based routing. Global setting only.',
    category: 'email_parsing',
    isEditable: true,
    validation: { 
      type: 'enum', 
      options: ['pattern', 'metadata', 'context'] 
    },
  },
  'email_parsing.parse_settings': {
    defaultValue: {
      subjectTokens: ['Re:', 'Fwd:', 'FW:', 'RE:', 'FWD:'],
      domains: ['infoglobaltech.com'],
      emailAddresses: []
    },
    valueType: 'object' as ConfigValueType,
    description: 'Email parsing settings. Used to clean email content during parsing. subjectTokens: array of subject prefixes to strip from subject line (case-insensitive). domains: array of internal email domains (without @). emailAddresses: array of specific internal email addresses. Global setting only.',
    category: 'email_parsing',
    isEditable: true,
  },
  'email_parsing.fuzzy_match_threshold': {
    defaultValue: 0.8, // 80% similarity required for match
    valueType: 'number' as ConfigValueType,
    description: 'Similarity threshold (0.0 to 1.0) for fuzzy matching when finding existing accounts and opportunities. Higher values (closer to 1.0) require more exact matches. Lower values allow more flexible matching. Default: 0.8 (80% similarity). Global setting only.',
    category: 'email_parsing',
    isEditable: true,
    validation: {
      type: 'min',
      min: 0,
    },
  },
  // Add more predefined settings here
};

