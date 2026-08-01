const express = require('express');
const router = express.Router();
const {
  createPost,
  getPost,
  updatePost,
  deletePost,
  toggleLike,
  toggleDownvote,
  toggleBookmark,
  acceptAnswer,
  sharePost,
  getComments,
  createComment,
  deleteComment,
  toggleCloseVote,
} = require('../controllers/postController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { checkPostLimit, checkBookmarkLimit } = require('../middleware/subscription');

router.post('/', authenticate, checkPostLimit, createPost);
router.get('/:id', optionalAuth, getPost);
router.put('/:id', authenticate, updatePost);
router.delete('/:id', authenticate, deletePost);

router.post('/:id/like', authenticate, toggleLike);
router.post('/:id/downvote', authenticate, toggleDownvote);
router.post('/:id/bookmark', authenticate, checkBookmarkLimit, toggleBookmark);
router.post('/:id/accept-answer', authenticate, acceptAnswer);
router.post('/:id/close-vote', authenticate, toggleCloseVote);
router.post('/:id/share', authenticate, sharePost);

router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', authenticate, createComment);
router.delete('/:id/comments/:commentId', authenticate, deleteComment);

module.exports = router;
