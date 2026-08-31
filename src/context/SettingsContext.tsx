import React, { createContext, useContext, useState, useEffect } from 'react';
import { SystemSettings } from '../types';
import { api } from '../services/api';

const DEFAULT_SETTINGS: SystemSettings = {
  panel_name: 'ZyroCloud Control Panel',
  logo_url: '',
  primary_color: '#06b6d4',
  secondary_color: '#8b5cf6',
  accent_color: '#10b981',
  background_style: 'dark_cyber',
  glow_intensity: 'medium',
  playit_enabled: 'true',
  max_servers_per_user: '5',
  default_allocation_start: '25565',
  default_allocation_end: '25600'
};

interface SettingsContextType {
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings((prev) => ({ ...prev, ...data }));
    } catch (err) {
      console.warn('Could not load remote settings, using local defaults');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<SystemSettings>) => {
    try {
      const res = await api.updateSettings(newSettings);
      setSettings(res.settings);
    } catch (err) {
      setSettings((prev) => ({ ...prev, ...newSettings }));
      throw err;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
