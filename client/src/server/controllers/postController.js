const mongoose = require('mongoose');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const Like = require('../models/Like');
const { extractHashtags, extractMentions } = require('../utils/hashtagExtractor');
const User = require('../models/User');
const { addReputation } = require('../utils/reputationHelper');

const POPULATE_AUTHOR = 'username displayName avatar';

const CLOSE_VOTE_THRESHOLD = 3;

async function createPost(req, res, next) {
  try {
    const { content, mediaUrls, postType } = req.body;
    const type = postType === 'answer' || postType === 'question' ? postType : 'post';

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content is required' });
    }

    const hashtags = extractHashtags(content);
    const mentions = extractMentions(content);

    const post = await Post.create({
      author: req.user._id,
      content,
      mediaUrls: mediaUrls || [],
      postType: type,
      hashtags,
      mentions,
    });

    if (type === 'answer') {
      await addReputation(req.user._id, 'post_answer', 'post', post._id);
    }

    const populated = await post.populate('author', POPULATE_AUTHOR);

    if (type === 'question') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const userDoc = await User.findById(req.user._id).select('postCount postCountResetDate');
      const needsReset = !userDoc.postCountResetDate || userDoc.postCountResetDate < today;

      if (needsReset) {
        await User.findByIdAndUpdate(req.user._id, { $set: { postCount: 1, postCountResetDate: today } });
      } else {
        await User.findByIdAndUpdate(req.user._id, { $inc: { postCount: 1 } });
      }
    }

    const io = req.app.get('io');
    if (io && mentions.length > 0) {
      const mentionedUsers = await mongoose.model('User').find({ username: { $in: mentions } });
      const notifications = mentionedUsers
        .filter((u) => u._id.toString() !== req.user._id.toString())
        .map((u) => ({
          recipient: u._id,
          sender: req.user._id,
          type: 'mention',
          post: post._id,
        }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
        mentionedUsers.forEach((u) => {
          if (u._id.toString() !== req.user._id.toString()) {
            io.to(u._id.toString()).emit('notification', {
              type: 'mention',
              sender: { _id: req.user._id, username: req.user.username },
              post: post._id,
            });
          }
        });
      }
    }

    res.status(201).json({ post: populated });
  } catch (error) {
    next(error);
  }
}

async function getPost(req, res, next) {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false })
      .populate('author', POPULATE_AUTHOR)
      .lean();

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    let isLiked = false;
    let isBookmarked = false;
    if (req.user) {
      const [likeDoc, bookmarkDoc] = await Promise.all([
        Like.findOne({ user: req.user._id, post: post._id, type: 'like' }).lean(),
        Like.findOne({ user: req.user._id, post: post._id, type: 'bookmark' }).lean(),
      ]);
      isLiked = !!likeDoc;
      isBookmarked = !!bookmarkDoc;
    }

    res.json({ post: { ...post, isLiked, isBookmarked } });
  } catch (error) {
    next(error);
  }
}

async function updatePost(req, res, next) {
  try {
    const { content, mediaUrls } = req.body;
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.author.toString() !== req.user._id.toString()) {
      if (req.user.reputation < 100) {
        return res.status(403).json({ error: 'You can only edit your own posts. Editing community posts requires 100 reputation.' });
      }
    }

    if (content) {
      post.content = content;
      post.hashtags = extractHashtags(content);
      post.mentions = extractMentions(content);
    }
    if (mediaUrls) post.mediaUrls = mediaUrls;
    post.isEdited = true;

    await post.save();
    const populated = await post.populate('author', POPULATE_AUTHOR);

    res.json({ post: populated });
  } catch (error) {
    next(error);
  }
}

async function deletePost(req, res, next) {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this post' });
    }

    const isAdminDeletingOthers = req.user.role === 'admin' && post.author.toString() !== req.user._id.toString();

    post.isDeleted = true;
    post.deletedAt = new Date();
    await post.save();

    if (isAdminDeletingOthers) {
      await addReputation(post.author, 'admin_removed', 'post', post._id);
    } else if (post.postType === 'answer') {
      await addReputation(req.user._id, 'answer_deleted', 'post', post._id);
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    next(error);
  }
}

async function toggleLike(req, res, next) {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const existing = await Like.findOne({
      user: req.user._id,
      post: post._id,
      type: 'like',
    });

    if (existing) {
      await Like.deleteOne({ _id: existing._id });
      const newCount = Math.max(0, post.likeCount - 1);
      let updateFields = { likeCount: newCount };
      if (post.postType !== 'post') {
        updateFields.upvoteCount = Math.max(0, (post.upvoteCount || 0) - 1);
      }
      await Post.findByIdAndUpdate(post._id, { $set: updateFields });

      const io = req.app.get('io');
      if (io) {
        io.to(`post:${post._id}`).emit('likeToggled', {
          postId: post._id,
          userId: req.user._id,
          liked: false,
          likeCount: newCount,
        });
      }

      res.json({ liked: false, likeCount: newCount });
    } else {
      await Like.create({ user: req.user._id, post: post._id, type: 'like' });
      const newCount = post.likeCount + 1;
      let updateFields = { likeCount: newCount };
      if (post.postType !== 'post') {
        updateFields.upvoteCount = (post.upvoteCount || 0) + 1;
      }
      await Post.findByIdAndUpdate(post._id, { $set: updateFields });

      if (post.author.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: post.author,
          sender: req.user._id,
          type: 'like',
          post: post._id,
        });

        const io = req.app.get('io');
        if (io) {
          io.to(post.author.toString()).emit('notification', {
            type: 'like',
            sender: { _id: req.user._id, username: req.user.username },
            post: post._id,
          });
        }
      }

      const newUpvoteCount = (post.upvoteCount || 0) + 1;
      if (post.postType === 'answer' && newUpvoteCount === 5) {
        await addReputation(post.author, 'answer_5_upvotes', 'post', post._id);
      }
      if (post.postType === 'question' && newUpvoteCount === 10) {
        await addReputation(post.author, 'question_10_upvotes', 'post', post._id);
      }

      const io = req.app.get('io');
      if (io) {
        io.to(`post:${post._id}`).emit('likeToggled', {
          postId: post._id,
          userId: req.user._id,
          liked: true,
          likeCount: newCount,
        });
      }

      res.json({ liked: true, likeCount: newCount });
    }
  } catch (error) {
    next(error);
  }
}

async function toggleDownvote(req, res, next) {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const existing = await Like.findOne({
      user: req.user._id,
      post: post._id,
      type: 'downvote',
    });

    if (existing) {
      await Like.deleteOne({ _id: existing._id });
      const newCount = Math.max(0, (post.downvoteCount || 0) - 1);
      await Post.findByIdAndUpdate(post._id, { $set: { downvoteCount: newCount } });

      if (post.author.toString() !== req.user._id.toString()) {
        await addReputation(post.author, 'downvote_reverted', 'post', post._id);
      }

      res.json({ downvoted: false, downvoteCount: newCount });
    } else {
      await Like.create({ user: req.user._id, post: post._id, type: 'downvote' });
      const newCount = (post.downvoteCount || 0) + 1;
      await Post.findByIdAndUpdate(post._id, { $set: { downvoteCount: newCount } });

      if (post.author.toString() !== req.user._id.toString()) {
        await addReputation(post.author, 'downvote_received', 'post', post._id);
      }

      res.json({ downvoted: true, downvoteCount: newCount });
    }
  } catch (error) {
    next(error);
  }
}

async function acceptAnswer(req, res, next) {
  try {
    const question = await Post.findOne({ _id: req.params.id, postType: 'question', isDeleted: false });
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the question author can accept an answer' });
    }

    const { answerId } = req.body;
    if (!answerId) {
      return res.status(400).json({ error: 'Answer ID is required' });
    }

    const answer = await Post.findOne({ _id: answerId, postType: 'answer', isDeleted: false });
    if (!answer) {
      return res.status(404).json({ error: 'Answer not found' });
    }

    if (question.acceptedAnswer) {
      if (question.acceptedAnswer.toString() === answer._id.toString()) {
        return res.status(400).json({ error: 'This answer is already marked as accepted' });
      }
    }

    const wasAccepted = question.acceptedAnswer;
    question.acceptedAnswer = answer._id;
    await question.save();

    if (!wasAccepted || wasAccepted.toString() !== answer._id.toString()) {
      await addReputation(answer.author, 'accepted_answer', 'post', answer._id);
    }

    res.json({ message: 'Answer accepted', acceptedAnswer: answer._id });
  } catch (error) {
    next(error);
  }
}

async function toggleBookmark(req, res, next) {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const existing = await Like.findOne({
      user: req.user._id,
      post: post._id,
      type: 'bookmark',
    });

    if (existing) {
      await Like.deleteOne({ _id: existing._id });
      await Post.findByIdAndUpdate(post._id, { $inc: { bookmarkCount: -1 } });
      res.json({ bookmarked: false, bookmarkCount: Math.max(0, post.bookmarkCount - 1) });
    } else {
      await Like.create({ user: req.user._id, post: post._id, type: 'bookmark' });
      await Post.findByIdAndUpdate(post._id, { $inc: { bookmarkCount: 1 } });
      res.json({ bookmarked: true, bookmarkCount: post.bookmarkCount + 1 });
    }
  } catch (error) {
    next(error);
  }
}

async function getComments(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter = { post: req.params.id, isDeleted: false, parentComment: null };

    const [comments, total] = await Promise.all([
      Comment.find(filter)
        .populate('author', POPULATE_AUTHOR)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Comment.countDocuments(filter),
    ]);

    const commentIds = comments.map((c) => c._id);
    const replies = await Comment.find({ parentComment: { $in: commentIds }, isDeleted: false })
      .populate('author', POPULATE_AUTHOR)
      .sort({ createdAt: 1 })
      .lean();

    const replyMap = {};
    replies.forEach((reply) => {
      const key = reply.parentComment.toString();
      if (!replyMap[key]) replyMap[key] = [];
      replyMap[key].push(reply);
    });

    const enriched = comments.map((c) => ({
      ...c,
      replies: replyMap[c._id.toString()] || [],
    }));

    res.json({
      comments: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + comments.length < total },
    });
  } catch (error) {
    next(error);
  }
}

async function createComment(req, res, next) {
  try {
    const { text, parentCommentId } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const DAILY_COMMENT_LIMIT = 3;
    if (req.user.reputation < 50) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayComments = await Comment.countDocuments({ author: req.user._id, createdAt: { $gte: today } });
      if (todayComments >= DAILY_COMMENT_LIMIT) {
        return res.status(429).json({
          error: `Commenting is limited to ${DAILY_COMMENT_LIMIT} per day below 50 reputation. Reach 50 reputation for unrestricted commenting.`,
        });
      }
    }

    let depth = 0;
    let parentComment = null;

    if (parentCommentId) {
      parentComment = await Comment.findById(parentCommentId);
      if (!parentComment || parentComment.isDeleted) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
      depth = Math.min(parentComment.depth + 1, 3);
    }

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      text,
      parentComment: parentCommentId || null,
      depth,
    });

    await Post.findByIdAndUpdate(post._id, { $inc: { commentCount: 1 } });

    const populated = await comment.populate('author', POPULATE_AUTHOR);

    if (post.author.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: post.author,
        sender: req.user._id,
        type: parentCommentId ? 'reply' : 'comment',
        post: post._id,
        comment: comment._id,
      });

      const io = req.app.get('io');
      if (io) {
        io.to(post.author.toString()).emit('notification', {
          type: parentCommentId ? 'reply' : 'comment',
          sender: { _id: req.user._id, username: req.user.username },
          post: post._id,
        });
      }
    }

    res.status(201).json({ comment: populated });
  } catch (error) {
    next(error);
  }
}

async function sharePost(req, res, next) {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    await Post.findByIdAndUpdate(post._id, { $inc: { shareCount: 1 } });

    const io = req.app.get('io');
    if (io) {
      io.to(`post:${post._id}`).emit('shareCountUpdated', {
        postId: post._id,
        shareCount: post.shareCount + 1,
      });
    }

    res.json({ shared: true, shareCount: post.shareCount + 1 });
  } catch (error) {
    next(error);
  }
}

async function deleteComment(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this comment' });
    }

    comment.isDeleted = true;
    await comment.save();

    await Post.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
}

async function toggleCloseVote(req, res, next) {
  try {
    if (req.user.reputation < 250) {
      return res.status(403).json({ error: 'Voting to close questions requires 250 reputation.' });
    }

    const post = await Post.findOne({ _id: req.params.id, postType: 'question', isDeleted: false });
    if (!post) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (post.author.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot vote to close your own question' });
    }

    const existing = await Like.findOne({
      user: req.user._id,
      post: post._id,
      type: 'close_vote',
    });

    if (existing) {
      await Like.deleteOne({ _id: existing._id });
      const newCount = Math.max(0, (post.closeVotes || 0) - 1);
      await Post.findByIdAndUpdate(post._id, {
        $set: { closeVotes: newCount, isClosed: newCount >= CLOSE_VOTE_THRESHOLD },
      });
      res.json({ closed: newCount >= CLOSE_VOTE_THRESHOLD, closeVotes: newCount });
    } else {
      await Like.create({ user: req.user._id, post: post._id, type: 'close_vote' });
      const newCount = (post.closeVotes || 0) + 1;
      await Post.findByIdAndUpdate(post._id, {
        $set: { closeVotes: newCount, isClosed: newCount >= CLOSE_VOTE_THRESHOLD },
      });
      res.json({ closed: newCount >= CLOSE_VOTE_THRESHOLD, closeVotes: newCount });
    }
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createPost,
  getPost,
  updatePost,
  deletePost,
  toggleLike,
  toggleDownvote,
  toggleBookmark,
  acceptAnswer,
  getComments,
  createComment,
  deleteComment,
  sharePost,
  toggleCloseVote,
};
