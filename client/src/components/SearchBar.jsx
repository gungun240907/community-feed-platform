import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useRouter } from 'next/router';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    setQuery('');
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative flex items-center transition-all duration-200 flex-shrink-0 ${
        isFocused ? 'w-40 sm:w-64' : 'w-28 sm:w-48'
      }`}
    >
      <Search size={15} className="absolute left-2.5 text-surface-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Search..."
        className="w-full bg-surface-100 border border-transparent focus:border-primary-300 focus:bg-white rounded-xl py-2.5 pl-8 pr-8 text-sm text-surface-700 placeholder-surface-400 outline-none transition-all"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-1 touch-btn text-surface-400 hover:text-surface-600"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
      <kbd className="absolute right-2 hidden sm:inline-flex items-center gap-0.5 text-[10px] text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-md border border-surface-200 font-mono">
        {isFocused ? '' : '⌘K'}
      </kbd>
    </form>
  );
}