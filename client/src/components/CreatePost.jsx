import React, { useState, useRef, useMemo } from 'react';
import { Image, X, Send, Loader2, AlertCircle, Crown } from 'lucide-react';
import { postAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';

const MAX_CHARS = 10000;

const PLAN_POST_LIMITS = { free: 1, bronze: 5, silver: 15, gold: -1 };

export default function CreatePost({ onPostCreated }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [mediaUrls, setMediaUrls] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaInput, setMediaInput] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const charsRemaining = MAX_CHARS - content.length;
  const isValid = content.trim().length > 0 && charsRemaining >= 0;

  const postLimit = useMemo(() => {
    const plan = user?.subscriptionPlan || 'free';
    const limit = PLAN_POST_LIMITS[plan] || 1;
    if (limit === -1) return { limit: '∞', used: 0, text: t('post.create.unlimited') };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resetDate = user?.postCountResetDate ? new Date(user.postCountResetDate) : null;
    const used = (!resetDate || resetDate < today) ? 0 : (user?.postCount || 0);
    const remaining = Math.max(0, limit - used);
    return { limit, used, remaining, text: t('post.create.limit', { remaining, limit }) };
  }, [user]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsSubmitting(true);
    Promise.all(files.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    })).then((urls) => {
      setMediaUrls((prev) => [...prev, ...urls].slice(0, 4));
      setIsSubmitting(false);
    }).catch(() => setIsSubmitting(false));
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError('');
    try {
      const response = await postAPI.create({ content, mediaUrls });
      setContent('');
      setMediaUrls([]);
      setShowMediaInput(false);
      if (onPostCreated) onPostCreated(response.data.post);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addMediaUrl = () => {
    if (mediaInput.trim() && mediaUrls.length < 4) {
      setMediaUrls((prev) => [...prev, mediaInput.trim()]);
      setMediaInput('');
      setShowMediaInput(false);
    }
  };

  const removeMedia = (index) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  const handleTextareaInput = (e) => {
    setContent(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card-hover p-4 sm:p-5 space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-200 flex items-start gap-2 animate-slide-down">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-full h-full object-cover rounded-full" />
          ) : (
            (user?.displayName || user?.username || 'U')[0].toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder={t('post.create.placeholder')}
            className="w-full resize-none border-0 bg-transparent placeholder-surface-400 text-surface-900 focus:outline-none focus:ring-0 text-sm min-h-[80px] leading-relaxed"
            rows={3}
            maxLength={MAX_CHARS}
          />

          {mediaUrls.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative group">
                  <img
                    src={url}
                    alt=""
                    className="h-20 w-20 object-cover rounded-xl border border-surface-200"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <button
                    type="button"
                    className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                    onClick={() => removeMedia(i)}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          {showMediaInput && (
            <div className="flex gap-2 mt-3 animate-slide-down">
              <input
                type="text"
                value={mediaInput}
                onChange={(e) => setMediaInput(e.target.value)}
                placeholder="Paste image URL..."
                className="input-field flex-1 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMediaUrl())}
                autoFocus
              />
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={addMediaUrl}
                disabled={!mediaInput.trim()}
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-surface-100">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost text-sm text-surface-400 hover:text-primary-600 gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Image size={18} />
            <span className="hidden sm:inline">{t('post.create.media')}</span>
          </button>
          <span className="text-xs text-surface-400 hidden sm:inline">{postLimit.text}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${
            charsRemaining < 100 ? 'text-red-500' : charsRemaining < 500 ? 'text-amber-500' : 'text-surface-400'
          }`}>
            {charsRemaining}
          </span>
          <button
            type="submit"
            className="btn-primary text-sm"
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin mr-1.5" /> {t('post.create.posting')}
              </>
            ) : (
              <>
                <Send size={16} className="mr-1.5" /> {t('post.create.post')}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
