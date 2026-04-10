import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import en from '../i18n/en';
import ar from '../i18n/ar';

const translations = { en, ar };

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem('lang') || 'en';
    } catch {
      return 'en';
    }
  });

  const isRTL = lang === 'ar';

  // Apply dir and lang to <html> element
  useEffect(() => {
    document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang, isRTL]);

  const setLang = useCallback((newLang) => {
    setLangState(newLang);
    try {
      localStorage.setItem('lang', newLang);
    } catch { /* ignore */ }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'ar' : 'en');
  }, [lang, setLang]);

  // Translation function — supports dot notation: t('nav.home')
  const t = useCallback((key) => {
    const keys = key.split('.');
    let value = translations[lang];
    for (const k of keys) {
      value = value?.[k];
    }
    // Fallback to English if not found
    if (value === undefined) {
      let fallback = translations.en;
      for (const k of keys) {
        fallback = fallback?.[k];
      }
      return fallback || key;
    }
    return value;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, isRTL, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
