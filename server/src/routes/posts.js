const express = require('express');
const router = express.Router();
const {
  createPost,
  getPost,
  updatePost,
  deletePost,
  toggleLike,
  toggleBookmark,
  getComments,
  createComment,
  deleteComment,
} = require('../controllers/postController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { createReport } = require('../controllers/adminController');

router.post('/', authenticate, createPost);
router.get('/:id', optionalAuth, getPost);
router.put('/:id', authenticate, updatePost);
router.delete('/:id', authenticate, deletePost);

router.post('/:id/like', authenticate, toggleLike);
router.post('/:id/bookmark', authenticate, toggleBookmark);

router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', authenticate, createComment);
router.delete('/:id/comments/:commentId', authenticate, deleteComment);

module.exports = router;
