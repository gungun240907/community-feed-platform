import React, { useState, useRef } from 'react';
import { Image, X, Send, Loader2, AlertCircle } from 'lucide-react';
import { postAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const MAX_CHARS = 10000;

export default function CreatePost({ onPostCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [mediaUrls, setMediaUrls] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaInput, setMediaInput] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  const charsRemaining = MAX_CHARS - content.length;
  const isValid = content.trim().length > 0 && charsRemaining >= 0;

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
            placeholder="Share a technical update, project showcase, or learning achievement..."
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
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                    onClick={() => removeMedia(i)}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

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
            onClick={() => setShowMediaInput(!showMediaInput)}
          >
            <Image size={18} />
            <span className="hidden sm:inline">Media</span>
          </button>
          <span className={`text-xs font-medium ${
            charsRemaining < 100 ? 'text-red-500' : charsRemaining < 500 ? 'text-amber-500' : 'text-surface-400'
          }`}>
            {charsRemaining}
          </span>
        </div>

        <button
          type="submit"
          className="btn-primary text-sm"
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin mr-1.5" /> Posting...
            </>
          ) : (
            <>
              <Send size={16} className="mr-1.5" /> Post
            </>
          )}
        </button>
      </div>
    </form>
  );
}
