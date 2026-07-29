import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Loader2, Save, ArrowLeft, AlertCircle, CheckCircle, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';
import { userAPI } from '../utils/api';
import api from '../utils/api';
import PhoneInput from '../components/PhoneInput';

export default function EditProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, updateUser } = useAuth();
  const fileInputRef = useRef(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setAvatar(user.avatar || '');
      setPhone(user.phone || '');
    }
  }, [user, isAuthenticated, authLoading, router]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setError('');
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const token = localStorage.getItem('token');
      const res = await api.post('/users/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatar(res.data.avatar);
      updateUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);
    try {
      const res = await userAPI.updateProfile({ displayName, bio, avatar, phone });
      updateUser(res.data.user);
      setSuccess(t('editProfile.success'));
      setTimeout(() => router.push(`/profile/${user.username}`), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="touch-btn rounded-xl text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-all"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
<h1 className="text-xl font-bold text-surface-900">{t('editProfile.title')}</h1>
           <p className="text-sm text-surface-500">{t('editProfile.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-primary-500/20 overflow-hidden hover:opacity-90 transition-opacity cursor-pointer"
          >
            {avatar ? (
              <img src={avatar} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              (displayName || user.username || 'U')[0].toUpperCase()
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-white" />
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            <CheckCircle size={16} className="flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="btn-secondary text-sm"
          >
            <Upload size={16} className="mr-1.5" />
            {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
          </button>
          <p className="text-xs text-surface-400 mt-1">JPG, PNG, GIF or WebP. Max 2MB.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('editProfile.phone')}</label>
          <PhoneInput
            value={phone}
            onChange={(val) => setPhone(val)}
            placeholder="Enter phone number"
          />
          <p className="text-xs text-surface-400 mt-1">{t('editProfile.phoneHint')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('editProfile.displayName')}</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            maxLength={50}
            className="input-field text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('editProfile.bio')}</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell the community about yourself..."
            maxLength={500}
            rows={4}
            className="input-field text-sm resize-y min-h-[100px]"
          />
          <p className="text-xs text-surface-400 mt-1 text-right">{bio.length}/500</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => router.back()}
          >
{t('editProfile.cancel')}
           </button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={isSaving}
          >
            {isSaving ? (
              <><Loader2 size={16} className="animate-spin mr-1.5" /> {t('editProfile.saving')}</>
            ) : (
              <><Save size={16} className="mr-1.5" /> {t('editProfile.save')}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}