import runHandler from '../../../../../lib/handler.js';
import { authenticate } from '../../../../../lib/middleware/auth.js';
import { requireAdmin } from '../../../../../lib/middleware/admin.js';
import Post from '../../../../../lib/models/Post.js';
import Report from '../../../../../lib/models/Report.js';

async function deletePostAsAdmin(req, res, next) {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.isDeleted = true;
    post.deletedAt = new Date();
    await post.save();

    await Report.updateMany(
      { post: postId, status: 'pending' },
      { status: 'actioned', actionedBy: req.user._id, actionedAt: new Date() }
    );

    res.json({ message: 'Post deleted and associated reports actioned' });
  } catch (error) {
    next(error);
  }
}

export default runHandler((req, res, next) => {
  if (req.method === 'DELETE') {
    return authenticate(req, res, () => {
      requireAdmin(req, res, () => deletePostAsAdmin(req, res, next));
    });
  }
  res.status(405).json({ error: 'Method not allowed' });
});
