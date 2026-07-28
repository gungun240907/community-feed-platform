import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const I18nContext = createContext(null);

const SUPPORTED_LANGUAGES = ['en', 'es', 'hi', 'pt', 'zh', 'fr'];

const FALLBACK_LANG = 'en';

function interpolate(text, params) {
  if (!params) return text;
  return Object.entries(params).reduce((str, [key, val]) => {
    return str.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  }, text);
}

const MESSAGE_LOADERS = {
  en: () => import('../i18n/en.json'),
  es: () => import('../i18n/es.json'),
  hi: () => import('../i18n/hi.json'),
  pt: () => import('../i18n/pt.json'),
  zh: () => import('../i18n/zh.json'),
  fr: () => import('../i18n/fr.json'),
};

async function loadMessages(lang) {
  try {
    const loader = MESSAGE_LOADERS[lang] || MESSAGE_LOADERS[FALLBACK_LANG];
    const module = await loader();
    return module.default || module;
  } catch {
    const fallback = await MESSAGE_LOADERS[FALLBACK_LANG]();
    return fallback.default || fallback;
  }
}

export function I18nProvider({ children }) {
  const { user, updateUser } = useAuth();
  const [lang, setLangState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('app_lang') || user?.language || FALLBACK_LANG;
    }
    return FALLBACK_LANG;
  });
  const [messages, setMessages] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (user?.language && user.language !== lang) {
      setLangState(user.language);
    }
  }, [user?.language]);

  useEffect(() => {
    loadMessages(lang).then((msgs) => {
      setMessages(msgs);
      setIsLoaded(true);
    });
  }, [lang]);

  const setLang = useCallback(async (newLang) => {
    if (!SUPPORTED_LANGUAGES.includes(newLang)) return;
    localStorage.setItem('app_lang', newLang);
    setLangState(newLang);
    if (user && updateUser) {
      updateUser({ language: newLang });
    }
  }, [user, updateUser]);

  const t = useCallback((key, defaultValOrParams, params) => {
    const val = messages[key];
    if (val === undefined) {
      if (typeof defaultValOrParams === 'string') return defaultValOrParams;
      return key;
    }
    if (typeof defaultValOrParams === 'object') {
      return interpolate(val, defaultValOrParams);
    }
    if (params && typeof params === 'object') {
      return interpolate(val, params);
    }
    return interpolate(val, null);
  }, [messages]);

  const getCurrentLang = useCallback(() => lang, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isLoaded, getCurrentLang, supportedLanguages: SUPPORTED_LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}

export { SUPPORTED_LANGUAGES };
