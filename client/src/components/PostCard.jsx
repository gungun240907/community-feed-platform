import React, { useState, memo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Edit3, Trash2, Flag, AlertTriangle } from 'lucide-react';
import { postAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import CommentSection from './CommentSection';

const PostCard = memo(function PostCard({ post, onUpdate, onDelete, onNotification }) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked || false);
  const [bookmarkCount, setBookmarkCount] = useState(post.bookmarkCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

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
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <article className="card-hover p-4 sm:p-6 space-y-4 animate-fade-in">
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
              {post.isEdited && (
                <span className="text-[11px] text-surface-400 italic font-medium">(edited)</span>
              )}
            </div>
            <span className="text-xs text-surface-400">{timeAgo(post.createdAt)}</span>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-xl text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-all"
          >
            <MoreHorizontal size={18} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-surface-200 py-1.5 z-20 animate-scale-in overflow-hidden">
                {isOwnPost && (
                  <>
                    <button
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface-50 flex items-center gap-2.5 text-surface-700 transition-colors"
                      onClick={() => setShowMenu(false)}
                    >
                      <Edit3 size={15} className="text-surface-400" /> Edit
                    </button>
                    <button
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-2.5 text-red-600 transition-colors"
                      onClick={() => { setShowMenu(false); setShowConfirmDelete(true); }}
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </>
                )}
                {!isOwnPost && (
                  <button
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-orange-50 flex items-center gap-2.5 text-orange-600 transition-colors"
                    onClick={() => { setShowMenu(false); setShowReportModal(true); }}
                  >
                    <Flag size={15} /> Report
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.content}
        </ReactMarkdown>
      </div>

      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className={`grid gap-2.5 ${post.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {post.mediaUrls.map((url, index) => (
            <div key={index} className="rounded-xl overflow-hidden bg-surface-100">
              <img
                src={url}
                alt={`Media ${index + 1}`}
                className="w-full h-48 sm:h-64 object-cover hover:scale-105 transition-transform duration-300"
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
              href={`/feed?hashtag=${tag}`}
              className="text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full hover:bg-primary-100 transition-colors"
            >
              #{tag}
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-surface-100">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 text-sm ${
              isLiked ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-surface-400 hover:text-red-500 hover:bg-red-50'
            }`}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
            {likeCount > 0 && <span className="text-xs font-semibold">{likeCount}</span>}
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 text-sm ${
              showComments ? 'text-primary-600 bg-primary-50' : 'text-surface-400 hover:text-primary-600 hover:bg-primary-50'
            }`}
            aria-label="Comments"
          >
            <MessageCircle size={18} />
            {post.commentCount > 0 && <span className="text-xs font-semibold">{post.commentCount}</span>}
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-surface-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-200 text-sm"
            aria-label="Share"
          >
            <Share2 size={18} />
          </button>
        </div>

        <button
          onClick={handleBookmark}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 text-sm ${
            isBookmarked ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' : 'text-surface-400 hover:text-amber-500 hover:bg-amber-50'
          }`}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
        >
          <Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
          {bookmarkCount > 0 && <span className="text-xs font-semibold">{bookmarkCount}</span>}
        </button>
      </div>

      {showComments && (
        <CommentSection postId={post._id} />
      )}

      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-surface-900">Delete Post?</h3>
                <p className="text-sm text-surface-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setShowConfirmDelete(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-scale-in">
            <h3 className="font-semibold text-lg text-surface-900">Report Post</h3>
            <select
              className="input-field"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            >
              <option value="">Select a reason</option>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="inappropriate">Inappropriate Content</option>
              <option value="misinformation">Misinformation</option>
              <option value="plagiarism">Plagiarism</option>
              <option value="other">Other</option>
            </select>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowReportModal(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleReport} disabled={!reportReason}>
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
});

export default PostCard;
