import React from 'react';
import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-[#15202b] transition-colors duration-300">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
        {children}
      </main>
      <footer className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-center text-xs text-surface-400 dark:text-[#5b6776]">
        <p>{'DevFeed — built for the developer community.'}</p>
      </footer>
    </div>
  );
}
