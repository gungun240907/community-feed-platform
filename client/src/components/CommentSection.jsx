import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Reply, Trash2, ChevronDown, MessageSquare } from 'lucide-react';
import { postAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocketContext } from '../context/SocketContext';
import { useTranslation } from '../context/I18nContext';

function CommentItem({ comment, onDelete, postId, depth = 0 }) {
  const { user } = useAuth();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replies, setReplies] = useState(comment.replies || []);
  const [showReplies, setShowReplies] = useState(true);
  const { t } = useTranslation();

  const isOwnComment = user && comment.author && (user._id === comment.author._id);

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('post.justNow');
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return new Date(date).toLocaleDateString();
  };

  const handleReply = async () => {
    if (!replyText.trim() || isSubmittingReply) return;
    setIsSubmittingReply(true);
    try {
      const response = await postAPI.createComment(postId, {
        text: replyText,
        parentCommentId: comment._id,
      });
      setReplies((prev) => [...prev, response.data.comment]);
      setReplyText('');
      setShowReplyInput(false);
    } catch (err) {
      console.error('Failed to reply:', err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  return (
    <div className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-surface-200' : ''} animate-fade-in`}>
      <div className="py-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-300 to-accent-300 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
            {comment.author?.avatar ? (
              <img src={comment.author.avatar} alt="" className="w-full h-full object-cover rounded-full" />
            ) : (
              (comment.author?.displayName || comment.author?.username || '?')[0].toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-surface-800">
                {comment.author?.displayName || comment.author?.username}
              </span>
              <span className="text-xs text-surface-400">{timeAgo(comment.createdAt)}</span>
            </div>
            <p className="text-sm text-surface-600 mt-0.5 leading-relaxed">{comment.text}</p>

            <div className="flex items-center gap-3 mt-2">
              {depth < 2 && (
                <button
                  className={`text-xs touch-btn gap-1 transition-colors ${
                    showReplyInput ? 'text-primary-600 font-medium' : 'text-surface-400 hover:text-primary-600'
                  }`}
                  onClick={() => setShowReplyInput(!showReplyInput)}
                >
                  <Reply size={13} /> {t('comment.reply')}
                </button>
              )}
              {isOwnComment && (
                <button
                  className="text-xs touch-btn gap-1 text-surface-400 hover:text-red-500 transition-colors"
                  onClick={() => onDelete(comment._id, postId)}
                >
                  <Trash2 size={13} /> {t('comment.delete')}
                </button>
              )}
            </div>

            {showReplyInput && (
              <div className="flex gap-2 mt-3 animate-slide-down">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={t('comment.placeholder')}
                  className="input-field flex-1 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                  autoFocus
                />
                <button
                  className="btn-primary text-xs"
                  onClick={handleReply}
                  disabled={!replyText.trim() || isSubmittingReply}
                >
                  {isSubmittingReply ? <Loader2 size={12} className="animate-spin" /> : t('comment.reply')}
                </button>
              </div>
            )}
          </div>
        </div>

        {replies.length > 0 && showReplies && (
          <div className="mt-1">
            {replies.map((reply) => (
              <CommentItem
                key={reply._id}
                comment={reply}
                onDelete={onDelete}
                postId={postId}
                depth={depth + 1}
              />
            ))}
          </div>
        )}

        {replies.length > 0 && !showReplies && (
          <button
            className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 mt-2 ml-10 transition-colors"
            onClick={() => setShowReplies(true)}
          >
            <ChevronDown size={14} /> Show {replies.length} repl{replies.length > 1 ? 'ies' : 'y'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CommentSection({ postId, onCommentCountChange }) {
  const { user } = useAuth();
  const { joinPost, leavePost } = useSocketContext();
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    joinPost(postId);
    return () => leavePost(postId);
  }, [postId, joinPost, leavePost]);

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await postAPI.getComments(postId);
      setComments(response.data.comments);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await postAPI.createComment(postId, { text: newComment });
      setComments((prev) => [response.data.comment, ...prev]);
      setNewComment('');
      if (onCommentCountChange) onCommentCountChange(1);
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await postAPI.deleteComment(postId, commentId);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      if (onCommentCountChange) onCommentCountChange(-1);
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmitComment();
    }
  };

  return (
    <div className="border-t border-surface-100 pt-4 space-y-4">
      {user && (
        <div className="flex gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm mt-0.5">
            {(user.displayName || user.username || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('comment.placeholder')}
              className="input-field flex-1 text-sm"
            />
            <button
              className="btn-primary text-sm"
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || isSubmitting}
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : t('comment.post')}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-surface-400" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <MessageSquare size={24} className="mx-auto text-surface-300" />
          <p className="text-sm text-surface-400">{t('comment.noComments')}</p>
        </div>
      ) : (
        <div className="divide-y divide-surface-50">
          {comments.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment}
              onDelete={handleDeleteComment}
              postId={postId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
