const mongoose = require('mongoose');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const Like = require('../models/Like');
const { extractHashtags, extractMentions } = require('../utils/hashtagExtractor');

const POPULATE_AUTHOR = 'username displayName avatar';

async function createPost(req, res, next) {
  try {
    const { content, mediaUrls } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content is required' });
    }

    const hashtags = extractHashtags(content);
    const mentions = extractMentions(content);

    const post = await Post.create({
      author: req.user._id,
      content,
      mediaUrls: mediaUrls || [],
      hashtags,
      mentions,
    });

    const populated = await post.populate('author', POPULATE_AUTHOR);

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
      return res.status(403).json({ error: 'You can only edit your own posts' });
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

    post.isDeleted = true;
    post.deletedAt = new Date();
    await post.save();

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
      await Post.findByIdAndUpdate(post._id, { $inc: { likeCount: -1 } });

      const io = req.app.get('io');
      if (io) {
        io.to(`post:${post._id}`).emit('likeToggled', {
          postId: post._id,
          userId: req.user._id,
          liked: false,
          likeCount: Math.max(0, post.likeCount - 1),
        });
      }

      res.json({ liked: false, likeCount: Math.max(0, post.likeCount - 1) });
    } else {
      await Like.create({ user: req.user._id, post: post._id, type: 'like' });
      await Post.findByIdAndUpdate(post._id, { $inc: { likeCount: 1 } });

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

      const io = req.app.get('io');
      if (io) {
        io.to(`post:${post._id}`).emit('likeToggled', {
          postId: post._id,
          userId: req.user._id,
          liked: true,
          likeCount: post.likeCount + 1,
        });
      }

      res.json({ liked: true, likeCount: post.likeCount + 1 });
    }
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

module.exports = {
  createPost,
  getPost,
  updatePost,
  deletePost,
  toggleLike,
  toggleBookmark,
  getComments,
  createComment,
  deleteComment,
};
