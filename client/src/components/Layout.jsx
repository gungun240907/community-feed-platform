import React from 'react';
import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      <div className="relative">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
