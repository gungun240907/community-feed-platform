import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminModerationTable from '../components/AdminModerationTable';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';

export default function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return <AdminModerationTable />;
}
