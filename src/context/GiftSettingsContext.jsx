import { createContext, useContext, useState, useEffect } from 'react';
import { apiGet, apiPut } from '../lib/api';

const GiftSettingsContext = createContext();

export function GiftSettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/gift-settings')
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const updateSettings = async (data) => {
    const updated = await apiPut('/gift-settings', data);
    setSettings(updated);
    return updated;
  };

  return (
    <GiftSettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </GiftSettingsContext.Provider>
  );
}

export const useGiftSettings = () => useContext(GiftSettingsContext);
