const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getUserPosts,
  uploadAvatar,
  upload,
} = require('../controllers/userController');
const { authenticate, optionalAuth } = require('../middleware/auth');

router.get('/:username', optionalAuth, getProfile);
router.put('/profile', authenticate, updateProfile);
router.post('/profile/avatar', authenticate, upload.single('avatar'), uploadAvatar);
router.post('/:username/follow', authenticate, followUser);
router.delete('/:username/follow', authenticate, unfollowUser);
router.get('/:username/followers', optionalAuth, getFollowers);
router.get('/:username/following', optionalAuth, getFollowing);
router.get('/:username/posts', optionalAuth, getUserPosts);

module.exports = router;
