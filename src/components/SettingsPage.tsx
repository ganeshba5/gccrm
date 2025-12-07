import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { canAccessAllData } from '../lib/auth-helpers';
import { configSettingService } from '../services/configSettingService';
import type { ConfigSetting, ConfigSettingFormData, ConfigScope, ConfigValueType } from '../types/configSetting';

type TabType = 'global' | 'user';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('user');
  const [isAdmin, setIsAdmin] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<ConfigSetting[]>([]);
  const [userSettings, setUserSettings] = useState<ConfigSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSetting, setEditingSetting] = useState<ConfigSetting | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<Partial<ConfigSettingFormData>>({
    key: '',
    scope: 'global',
    valueType: 'string',
    value: '',
    isEditable: true,
    category: '',
  });

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      const adminStatus = await canAccessAllData();
      setIsAdmin(adminStatus);
      if (adminStatus) {
        setActiveTab('global'); // Default to global tab for admins
      }
    };
    if (user) {
      checkAdmin();
    }
  }, [user]);

  // Load settings
  useEffect(() => {
    loadSettings();
  }, [activeTab, user]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'global' && isAdmin) {
        const settings = await configSettingService.getConfigSettings('global');
        setGlobalSettings(settings);
      } else if (activeTab === 'user' && user) {
        const settings = await configSettingService.getConfigSettings('user', undefined, user.id);
        setUserSettings(settings);
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!user) return;

      if (!formData.key || !formData.scope || !formData.valueType) {
        setError('Key, scope, and value type are required');
        return;
      }

      // Convert value based on type
      let convertedValue: any = formData.value;
      if (formData.valueType === 'number') {
        convertedValue = formData.value ? Number(formData.value) : 0;
      } else if (formData.valueType === 'boolean') {
        convertedValue = formData.value === 'true' || formData.value === true;
      } else if (formData.valueType === 'json' || formData.valueType === 'array' || formData.valueType === 'object') {
        try {
          convertedValue = formData.value ? JSON.parse(formData.value as string) : null;
        } catch (e) {
          setError('Invalid JSON format');
          return;
        }
      }

      const settingData: ConfigSettingFormData = {
        key: formData.key,
        scope: formData.scope as ConfigScope,
        value: convertedValue,
        valueType: formData.valueType as ConfigValueType,
        isEditable: formData.isEditable ?? true,
        category: formData.category || undefined,
        description: formData.description || undefined,
        defaultValue: formData.defaultValue || undefined,
        validation: formData.validation || undefined,
        userId: formData.scope === 'user' ? user.id : undefined,
      };

      await configSettingService.setConfigSetting(settingData);
      
      setEditingSetting(null);
      setShowCreateForm(false);
      resetForm();
      await loadSettings();
    } catch (err: any) {
      console.error('Error saving setting:', err);
      setError(err.message || 'Failed to save setting');
    }
  };

  const handleDelete = async (settingId: string) => {
    if (!confirm('Are you sure you want to delete this setting?')) {
      return;
    }

    try {
      await configSettingService.deleteConfigSetting(settingId);
      await loadSettings();
    } catch (err: any) {
      console.error('Error deleting setting:', err);
      setError(err.message || 'Failed to delete setting');
    }
  };

  const handleEdit = (setting: ConfigSetting) => {
    setEditingSetting(setting);
    setFormData({
      key: setting.key,
      scope: setting.scope,
      valueType: setting.valueType,
      value: setting.valueType === 'json' || setting.valueType === 'array' || setting.valueType === 'object'
        ? JSON.stringify(setting.value, null, 2)
        : String(setting.value),
      isEditable: setting.isEditable,
      category: setting.category || '',
      description: setting.description || '',
      defaultValue: setting.defaultValue || undefined,
      validation: setting.validation || undefined,
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setFormData({
      key: '',
      scope: 'global',
      valueType: 'string',
      value: '',
      isEditable: true,
      category: '',
    });
    setEditingSetting(null);
  };

  const getCurrentSettings = () => {
    return activeTab === 'global' ? globalSettings : userSettings;
  };

  const groupSettingsByCategory = (settings: ConfigSetting[]) => {
    const grouped: Record<string, ConfigSetting[]> = {};
    settings.forEach(setting => {
      const category = setting.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(setting);
    });
    return grouped;
  };

  const renderValueInput = () => {
    const { valueType, value } = formData;

    switch (valueType) {
      case 'boolean':
        return (
          <select
            value={String(value)}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            value={value as string}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      case 'json':
        return (
          <textarea
            value={value as string}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder='{"key": "value"}'
          />
        );
      case 'array':
        return (
          <textarea
            value={value as string}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder='["value1", "value2"] or [] for empty array'
          />
        );
      case 'object':
        return (
          <textarea
            value={value as string}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder='{"key": "value"}'
          />
        );
      default:
        return (
          <input
            type="text"
            value={value as string}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  if (loading && getCurrentSettings().length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  const settings = getCurrentSettings();
  const groupedSettings = groupSettingsByCategory(settings);

  return (
    <div className="p-6 space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-4xl">⚙️</span>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => {
              resetForm();
              setFormData({ ...formData, scope: activeTab as ConfigScope });
              setShowCreateForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + New Setting
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      {isAdmin && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => {
                setActiveTab('global');
                setShowCreateForm(false);
                resetForm();
              }}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'global'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Global Settings
            </button>
            <button
              onClick={() => {
                setActiveTab('user');
                setShowCreateForm(false);
                resetForm();
              }}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'user'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My Settings
            </button>
          </nav>
        </div>
      )}

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingSetting ? 'Edit Setting' : 'Create New Setting'}
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key *
              </label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                disabled={!!editingSetting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="e.g., opportunities.view_history_from"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scope *
              </label>
              <select
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value as ConfigScope })}
                disabled={!!editingSetting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="global">Global</option>
                <option value="user">User</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value Type *
              </label>
              <select
                value={formData.valueType}
                onChange={(e) => {
                  setFormData({ 
                    ...formData, 
                    valueType: e.target.value as ConfigValueType,
                    value: '' // Reset value when type changes
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="json">JSON</option>
                <option value="array">Array</option>
                <option value="object">Object</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., opportunities, ui, notifications"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Value *
            </label>
            {renderValueInput()}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Description of this setting"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setShowCreateForm(false);
                resetForm();
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Settings List */}
      {!showCreateForm && (
        <div className="space-y-6">
          {Object.keys(groupedSettings).length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              No settings found. Create your first setting to get started.
            </div>
          ) : (
            Object.entries(groupedSettings).map(([category, categorySettings]) => (
              <div key={category} className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">{category}</h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {categorySettings.map((setting) => (
                    <div key={setting.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-medium text-gray-900">{setting.key}</h3>
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                              {setting.scope}
                            </span>
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded">
                              {setting.valueType}
                            </span>
                          </div>
                          {setting.description && (
                            <p className="mt-1 text-sm text-gray-500">{setting.description}</p>
                          )}
                          <div className="mt-2">
                            <span className="text-sm text-gray-700">
                              <strong>Value:</strong>{' '}
                              {setting.valueType === 'json' || setting.valueType === 'array' || setting.valueType === 'object'
                                ? JSON.stringify(setting.value)
                                : String(setting.value)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleEdit(setting)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(setting.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
