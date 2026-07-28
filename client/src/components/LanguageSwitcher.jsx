import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useTranslation } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import LanguageVerifyModal from './LanguageVerifyModal';

const LANGUAGES = [
  { code: 'en', labelKey: 'language.en' },
  { code: 'es', labelKey: 'language.es' },
  { code: 'hi', labelKey: 'language.hi' },
  { code: 'pt', labelKey: 'language.pt' },
  { code: 'zh', labelKey: 'language.zh' },
  { code: 'fr', labelKey: 'language.fr' },
];

const LANG_LABELS = { en: 'English', es: 'Español', hi: 'हिंदी', pt: 'Português', zh: '中文', fr: 'Français' };

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [verifyLang, setVerifyLang] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (code) => {
    setOpen(false);
    if (code === lang) return;
    if (isAuthenticated) {
      setVerifyLang(code);
    } else {
      setLang(code);
    }
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          className="btn-ghost text-sm"
          onClick={() => setOpen(!open)}
          title={t('language.select')}
          aria-label={t('language.select')}
        >
          <Globe size={18} />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-surface-200 py-1.5 z-20 animate-scale-in overflow-hidden">
            {LANGUAGES.map(({ code }) => (
              <button
                key={code}
                className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                  lang === code ? 'bg-primary-50 text-primary-700 font-medium' : 'text-surface-700 hover:bg-surface-50'
                }`}
                onClick={() => handleSelect(code)}
              >
                <span className="flex-1">{LANG_LABELS[code]}</span>
                {lang === code && <Check size={16} className="text-primary-500" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {verifyLang && (
        <LanguageVerifyModal
          targetLang={verifyLang}
          onClose={() => setVerifyLang(null)}
          onVerified={(code, data) => {
            setLang(code);
            setVerifyLang(null);
          }}
        />
      )}
    </>
  );
}
