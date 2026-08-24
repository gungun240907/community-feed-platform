import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const countries = [
  { code: '+1', name: 'US', label: 'United States' },
  { code: '+1', name: 'CA', label: 'Canada' },
  { code: '+44', name: 'GB', label: 'United Kingdom' },
  { code: '+91', name: 'IN', label: 'India' },
  { code: '+61', name: 'AU', label: 'Australia' },
  { code: '+81', name: 'JP', label: 'Japan' },
  { code: '+86', name: 'CN', label: 'China' },
  { code: '+49', name: 'DE', label: 'Germany' },
  { code: '+33', name: 'FR', label: 'France' },
  { code: '+39', name: 'IT', label: 'Italy' },
  { code: '+55', name: 'BR', label: 'Brazil' },
  { code: '+7', name: 'RU', label: 'Russia' },
  { code: '+82', name: 'KR', label: 'South Korea' },
  { code: '+31', name: 'NL', label: 'Netherlands' },
  { code: '+34', name: 'ES', label: 'Spain' },
  { code: '+41', name: 'CH', label: 'Switzerland' },
  { code: '+46', name: 'SE', label: 'Sweden' },
  { code: '+47', name: 'NO', label: 'Norway' },
  { code: '+45', name: 'DK', label: 'Denmark' },
  { code: '+358', name: 'FI', label: 'Finland' },
  { code: '+48', name: 'PL', label: 'Poland' },
  { code: '+30', name: 'GR', label: 'Greece' },
  { code: '+351', name: 'PT', label: 'Portugal' },
  { code: '+353', name: 'IE', label: 'Ireland' },
  { code: '+43', name: 'AT', label: 'Austria' },
  { code: '+32', name: 'BE', label: 'Belgium' },
  { code: '+36', name: 'HU', label: 'Hungary' },
  { code: '+420', name: 'CZ', label: 'Czech Republic' },
  { code: '+65', name: 'SG', label: 'Singapore' },
  { code: '+60', name: 'MY', label: 'Malaysia' },
  { code: '+63', name: 'PH', label: 'Philippines' },
  { code: '+62', name: 'ID', label: 'Indonesia' },
  { code: '+64', name: 'NZ', label: 'New Zealand' },
  { code: '+971', name: 'AE', label: 'UAE' },
  { code: '+966', name: 'SA', label: 'Saudi Arabia' },
  { code: '+20', name: 'EG', label: 'Egypt' },
  { code: '+27', name: 'ZA', label: 'South Africa' },
  { code: '+234', name: 'NG', label: 'Nigeria' },
  { code: '+254', name: 'KE', label: 'Kenya' },
  { code: '+52', name: 'MX', label: 'Mexico' },
  { code: '+54', name: 'AR', label: 'Argentina' },
  { code: '+56', name: 'CL', label: 'Chile' },
  { code: '+57', name: 'CO', label: 'Colombia' },
  { code: '+98', name: 'IR', label: 'Iran' },
  { code: '+90', name: 'TR', label: 'Turkey' },
  { code: '+92', name: 'PK', label: 'Pakistan' },
  { code: '+880', name: 'BD', label: 'Bangladesh' },
  { code: '+94', name: 'LK', label: 'Sri Lanka' },
  { code: '+977', name: 'NP', label: 'Nepal' },
  { code: '+84', name: 'VN', label: 'Vietnam' },
  { code: '+66', name: 'TH', label: 'Thailand' },
];

function parseInitial(value) {
  if (!value) return { countryCode: '+1', number: '' };
  for (const c of countries) {
    if (value.startsWith(c.code)) {
      return { countryCode: c.code, number: value.slice(c.code.length) };
    }
  }
  return { countryCode: '+1', number: value };
}

export default function PhoneInput({ value, onChange, placeholder, className }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  const { countryCode, number } = parseInitial(value);

  const selected = countries.find((c) => c.code === countryCode) || countries[0];

  const filtered = search
    ? countries.filter(
        (c) =>
          c.label.toLowerCase().includes(search.toLowerCase()) ||
          c.code.includes(search) ||
          c.name.toLowerCase().includes(search.toLowerCase())
      )
    : countries;

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleNumberChange = (e) => {
    const num = e.target.value.replace(/\D/g, '');
    onChange(countryCode + num);
  };

  const selectCountry = (c) => {
    const num = number.replace(/\D/g, '');
    onChange(c.code + num);
    setOpen(false);
    setSearch('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex gap-0" ref={ref}>
      <div className="relative">
        <button
          type="button"
          className="flex items-center gap-1 px-3 h-[42px] border border-r-0 border-surface-300 rounded-l-xl bg-surface-50 hover:bg-surface-100 transition-colors text-sm font-medium text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
          onClick={() => setOpen(!open)}
        >
          <span className="w-5 text-center">{selected.name}</span>
          <span className="text-surface-400">{selected.code}</span>
          <ChevronDown size={14} className={`text-surface-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-card rounded-xl shadow-xl border border-surface-200 z-30 animate-scale-in overflow-hidden">
            <div className="p-2 border-b border-surface-100">
              <input
                type="text"
                className="input-field text-sm h-9"
                placeholder="Search country..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-52 overflow-y-auto p-1">
              {filtered.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    c.code === countryCode && c.name === selected.name
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-surface-50 text-surface-700'
                  }`}
                  onClick={() => selectCountry(c)}
                >
                  <span className="w-7 text-center font-medium text-surface-500 text-xs">{c.name}</span>
                  <span className="text-surface-400">{c.code}</span>
                  <span className="flex-1 text-left">{c.label}</span>
                  {c.code === countryCode && c.name === selected.name && (
                    <Check size={14} className="text-primary-600" />
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-surface-400 text-center py-6">No countries found</p>
              )}
            </div>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="tel"
        className={`input-field rounded-l-none ${className || ''}`}
        value={number}
        onChange={handleNumberChange}
        placeholder={placeholder || 'Enter phone number'}
      />
    </div>
  );
}
