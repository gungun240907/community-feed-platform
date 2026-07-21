const DECAY_FACTOR = 0.01;
const LIKE_WEIGHT = 1;
const COMMENT_WEIGHT = 2;
const SHARE_WEIGHT = 3;
const BOOKMARK_WEIGHT = 1.5;

export function calculateEngagementScore(post) {
  const now = Date.now();
  const createdAt = new Date(post.createdAt).getTime();
  const ageInHours = (now - createdAt) / (1000 * 60 * 60);

  const rawScore =
    post.likeCount * LIKE_WEIGHT +
    post.commentCount * COMMENT_WEIGHT +
    post.shareCount * SHARE_WEIGHT +
    post.bookmarkCount * BOOKMARK_WEIGHT;

  const decay = Math.exp(-DECAY_FACTOR * ageInHours);
  return rawScore * decay;
}

export function calculateBulkScores(posts) {
  return posts.map((post) => ({
    ...post,
    engagementScore: calculateEngagementScore(post),
  }));
}
