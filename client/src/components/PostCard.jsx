import React, { useState, memo, useCallback, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Edit3, Trash2, Flag, AlertTriangle, X, Image, Loader2 } from 'lucide-react';
import { postAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import CommentSection from './CommentSection';
import PostTypeBadge from './PostTypeBadge';
import { useTranslation } from '../context/I18nContext';

const PostCard = memo(function PostCard({ post, onUpdate, onDelete }) {
  const { user } = useAuth();
  const { socket, joinPost, leavePost } = useSocketContext();
  const isCompact = useMemo(() => typeof window !== 'undefined' && localStorage.getItem('beta_compact') === 'true', []);
  const { t } = useTranslation();
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked || false);
  const [bookmarkCount, setBookmarkCount] = useState(post.bookmarkCount || 0);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editMediaUrls, setEditMediaUrls] = useState([]);
  const [editMediaInput, setEditMediaInput] = useState('');
  const [showEditMediaInput, setShowEditMediaInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!socket || !post._id) return;
    joinPost(post._id);

    const handleLikeToggled = (data) => {
      if (data.postId === post._id) {
        setLikeCount(data.likeCount);
        setIsLiked(data.liked);
      }
    };

    const handleShareUpdated = (data) => {
      if (data.postId === post._id && onUpdate) {
        onUpdate(post._id, { shareCount: data.shareCount });
      }
    };

    socket.on('likeToggled', handleLikeToggled);
    socket.on('shareCountUpdated', handleShareUpdated);

    return () => {
      leavePost(post._id);
      socket.off('likeToggled', handleLikeToggled);
      socket.off('shareCountUpdated', handleShareUpdated);
    };
  }, [socket, post._id, joinPost, leavePost, onUpdate]);

  const isOwnPost = user && post.author && (user._id === post.author._id || user._id === post.author);

  const handleLike = useCallback(async () => {
    const previousLiked = isLiked;
    const previousCount = likeCount;

    setIsLiked(!isLiked);
    setLikeCount((c) => (isLiked ? c - 1 : c + 1));

    try {
      const response = await postAPI.toggleLike(post._id);
      setIsLiked(response.data.liked);
      setLikeCount(response.data.likeCount);
      if (onUpdate) onUpdate(post._id, { likeCount: response.data.likeCount });
    } catch {
      setIsLiked(previousLiked);
      setLikeCount(previousCount);
    }
  }, [post._id, isLiked, likeCount, onUpdate]);

  const handleBookmark = useCallback(async () => {
    const previousBookmarked = isBookmarked;
    const previousCount = bookmarkCount;

    setIsBookmarked(!isBookmarked);
    setBookmarkCount((c) => (isBookmarked ? c - 1 : c + 1));

    try {
      const response = await postAPI.toggleBookmark(post._id);
      setIsBookmarked(response.data.bookmarked);
      setBookmarkCount(response.data.bookmarkCount);
    } catch {
      setIsBookmarked(previousBookmarked);
      setBookmarkCount(previousCount);
    }
  }, [post._id, isBookmarked, bookmarkCount]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await postAPI.delete(post._id);
      if (onDelete) onDelete(post._id);
    } catch (err) {
      console.error('Failed to delete post:', err);
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  }, [post._id, onDelete]);

  const handleReport = useCallback(async () => {
    if (!reportReason) return;
    try {
      await postAPI.report(post._id, { reason: reportReason });
      setShowReportModal(false);
      setReportReason('');
    } catch (err) {
      console.error('Failed to report post:', err);
    }
  }, [post._id, reportReason]);

  const handleShare = useCallback(async () => {
    postAPI.share(post._id).catch(() => {});
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this post!',
          url: `${window.location.origin}/post/${post._id}`,
        });
      } catch { }
    } else {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/post/${post._id}`);
      } catch { }
    }
  }, [post._id]);

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('post.justNow');
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <article className={`card-hover animate-fade-in ${isCompact ? 'p-3 sm:p-4 space-y-2' : 'p-4 sm:p-6 space-y-4'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <a href={`/profile/${post.author?.username}`} className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {post.author?.avatar ? (
                <img src={post.author.avatar} alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                (post.author?.displayName || post.author?.username || '?')[0].toUpperCase()
              )}
            </div>
          </a>
          <div>
            <div className="flex items-center gap-2">
              <a href={`/profile/${post.author?.username}`} className="font-semibold text-sm text-surface-900 hover:text-primary-600 transition-colors">
                {post.author?.displayName || post.author?.username || 'Unknown'}
              </a>
              <PostTypeBadge type={post.postType} />
              {post.isEdited && (
                <span className="text-[11px] text-surface-400 italic font-medium">{t('post.edited')}</span>
              )}
            </div>
            <span className="text-xs text-surface-400">{timeAgo(post.createdAt)}</span>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="touch-btn rounded-xl text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-all"
            aria-label="More actions"
          >
            <MoreHorizontal size={18} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-card dark:bg-[#1e2732] dark:border-[#38444d] rounded-xl shadow-xl border border-surface-200 py-1.5 z-20 animate-scale-in overflow-hidden">
                {isOwnPost && (
                  <>
                    <button
                       className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface-50 dark:hover:bg-[#253341] flex items-center gap-2.5 text-surface-700 dark:text-[#e7e9ea] transition-colors"
                      onClick={() => { setShowMenu(false); setEditContent(post.content); setEditMediaUrls(post.mediaUrls || []); setIsEditing(true); }}
                    >
                      <Edit3 size={15} className="text-surface-400" /> {t('post.edit')}
                    </button>
                    <button
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-2.5 text-red-600 transition-colors"
                      onClick={() => { setShowMenu(false); setShowConfirmDelete(true); }}
                    >
                      <Trash2 size={15} /> {t('post.delete')}
                    </button>
                  </>
                )}
                {!isOwnPost && (
                  <button
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-orange-50 flex items-center gap-2.5 text-orange-600 transition-colors"
                    onClick={() => { setShowMenu(false); setShowReportModal(true); }}
                  >
                    <Flag size={15} /> {t('post.report')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="prose prose-sm max-w-none overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {post.content}
        </ReactMarkdown>
      </div>

      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className={`grid gap-2.5 ${post.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {post.mediaUrls.map((url, index) => (
            <div key={index} className="rounded-xl overflow-hidden bg-surface-100">
              <img
                src={url}
                alt={`Media ${index + 1}`}
                   className="w-full max-h-[500px] object-contain bg-surface-100 dark:bg-[#253341] rounded-xl"
                loading="lazy"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          ))}
        </div>
      )}

      {post.hashtags && post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.hashtags.map((tag) => (
            <a
              key={tag}
              href={`/?hashtag=${tag}`}
              className="text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full hover:bg-primary-100 transition-colors"
            >
              #{tag}
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-surface-100">
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            onClick={handleLike}
            className={`touch-btn gap-1.5 px-3 sm:px-4 rounded-xl transition-all duration-200 text-sm ${
              isLiked ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-surface-400 hover:text-red-500 hover:bg-red-50'
            }`}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
            {likeCount > 0 && <span className="text-xs font-semibold">{likeCount}</span>}
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className={`touch-btn gap-1.5 px-3 sm:px-4 rounded-xl transition-all duration-200 text-sm ${
              showComments ? 'text-primary-600 bg-primary-50' : 'text-surface-400 hover:text-primary-600 hover:bg-primary-50'
            }`}
            aria-label="Comments"
          >
            <MessageCircle size={18} />
            {commentCount > 0 && <span className="text-xs font-semibold">{commentCount}</span>}
          </button>

          <button
            onClick={handleShare}
            className="touch-btn gap-1.5 px-3 sm:px-4 rounded-xl text-surface-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-200 text-sm"
            aria-label="Share"
          >
            <Share2 size={18} />
          </button>
        </div>

        <button
          onClick={handleBookmark}
          className={`touch-btn gap-1.5 px-3 sm:px-4 rounded-xl transition-all duration-200 text-sm ${
            isBookmarked ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' : 'text-surface-400 hover:text-amber-500 hover:bg-amber-50'
          }`}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
        >
          <Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
          {bookmarkCount > 0 && <span className="text-xs font-semibold">{bookmarkCount}</span>}
        </button>
      </div>

      {showComments && (
        <CommentSection postId={post._id} onCommentCountChange={(delta) => setCommentCount((c) => c + delta)} />
      )}

      {isEditing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-card dark:bg-[#1e2732] dark:border dark:border-[#38444d] rounded-2xl p-6 max-w-lg w-full shadow-float space-y-4 animate-scale-in my-8">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg text-surface-900">{t('post.editModal.title')}</h3>
              <button className="touch-btn rounded-xl text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-all" onClick={() => setIsEditing(false)}>
                <X size={18} />
              </button>
            </div>

            <textarea
              className="input-field min-h-[120px] resize-y text-sm"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              maxLength={10000}
              autoFocus
            />

            {editMediaUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {editMediaUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className="h-20 w-20 object-contain rounded-xl border border-surface-200 bg-surface-100" onError={(e) => { e.target.style.display = 'none'; }} />
                    <button type="button" className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600" onClick={() => setEditMediaUrls((prev) => prev.filter((_, j) => j !== i))}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showEditMediaInput && (
              <div className="flex gap-2 animate-slide-down">
                <input type="text" value={editMediaInput} onChange={(e) => setEditMediaInput(e.target.value)} placeholder="Paste image URL..." className="input-field flex-1 text-sm" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), setEditMediaUrls((prev) => [...prev, editMediaInput.trim()]), setEditMediaInput(''), setShowEditMediaInput(false))} autoFocus />
                <button type="button" className="btn-primary text-sm" onClick={() => { setEditMediaUrls((prev) => [...prev, editMediaInput.trim()]); setEditMediaInput(''); setShowEditMediaInput(false); }} disabled={!editMediaInput.trim()}>Add</button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button type="button" className="btn-ghost text-sm text-surface-400 gap-1.5" onClick={() => setShowEditMediaInput(!showEditMediaInput)}>
                <Image size={16} /> {t('post.create.media')}
              </button>
              <div className="flex gap-3">
                <button className="btn-secondary text-sm" onClick={() => setIsEditing(false)}>{t('post.editModal.cancel')}</button>
                <button className="btn-primary text-sm" onClick={async () => {
                  if (!editContent.trim() || isSaving) return;
                  setIsSaving(true);
                  try {
                    const response = await postAPI.update(post._id, { content: editContent, mediaUrls: editMediaUrls });
                    if (onUpdate) onUpdate(post._id, { content: editContent, mediaUrls: editMediaUrls, isEdited: true });
                    setIsEditing(false);
                  } catch (err) {
                    console.error('Failed to update post:', err);
                  } finally {
                    setIsSaving(false);
                  }
                }} disabled={!editContent.trim() || isSaving}>
                  {isSaving ? <><Loader2 size={16} className="animate-spin mr-1.5" /> {t('post.editModal.saving')}</> : t('post.editModal.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-card dark:bg-[#1e2732] dark:border dark:border-[#38444d] rounded-2xl p-6 max-w-sm w-full shadow-float space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/15 flex items-center justify-center">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-surface-900">{t('post.deleteConfirm.title')}</h3>
                <p className="text-sm text-surface-500">{t('post.deleteConfirm.message')}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setShowConfirmDelete(false)}>{t('post.deleteConfirm.cancel')}</button>
              <button className="btn-danger" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? t('post.delete') + '...' : t('post.deleteConfirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-card dark:bg-[#1e2732] dark:border dark:border-[#38444d] rounded-2xl p-6 max-w-sm w-full shadow-float space-y-4 animate-scale-in">
            <h3 className="font-semibold text-lg text-surface-900">{t('post.reportModal.title')}</h3>
            <select
              className="input-field"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            >
              <option value="">{t('post.reportModal.selectReason')}</option>
              <option value="spam">{t('post.reportModal.reason.spam')}</option>
              <option value="harassment">{t('post.reportModal.reason.harassment')}</option>
              <option value="inappropriate">{t('post.reportModal.reason.inappropriate')}</option>
              <option value="misinformation">{t('post.reportModal.reason.misinformation')}</option>
              <option value="plagiarism">{t('post.reportModal.reason.plagiarism')}</option>
              <option value="other">{t('post.reportModal.reason.other')}</option>
            </select>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowReportModal(false)}>{t('common.cancel')}</button>
              <button className="btn-danger" onClick={handleReport} disabled={!reportReason}>
                {t('post.reportModal.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
});

export default PostCard;
