const BASE = 'https://client-eight-sigma-47.vercel.app/api';
const SUF = Date.now().toString(36).slice(-6);

async function req(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

let passed = 0, failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}${extra ? ' — ' + extra : ''}`); }
  else { failed++; console.log(`  FAIL  ${name}${extra ? ' — ' + extra : ''}`); }
}

async function main() {
  const userA = `e2e_${SUF}a`;
  const userB = `e2e_${SUF}b`;
  const pwdA = 'Alpha123!', pwdB = 'Beta123!';

  console.log(`\n========== E2E against ${BASE} ==========`);
  console.log(`Users: ${userA} / ${userB}\n`);

  // ---- AUTH ----
  console.log('[AUTH]');
  let r = await req('POST', '/auth/register', { body: { username: userA, email: `${userA}@test.dev`, password: pwdA, displayName: 'E2E Alpha' } });
  const tA = r.data?.token;
  check('register user A (201)', r.status === 201, `id=${r.data?.user?._id}`);
  const aId = r.data?.user?._id;

  r = await req('POST', '/auth/register', { body: { username: userB, email: `${userB}@test.dev`, password: pwdB, displayName: 'E2E Beta' } });
  const tB = r.data?.token;
  check('register user B (201)', r.status === 201);

  r = await req('POST', '/auth/login', { body: { login: userA, password: 'wrongpass' } });
  check('login wrong password (401)', r.status === 401);

  r = await req('POST', '/auth/login', { body: { login: userA, password: pwdA } });
  check('login correct password (200)', r.status === 200 && !!r.data?.token);

  r = await req('GET', '/auth/me', { token: tA });
  check('GET /auth/me (200)', r.status === 200 && r.data?.user?.username === userA);

  r = await req('GET', '/auth/me');
  check('GET /auth/me no token (401)', r.status === 401);

  r = await req('POST', '/auth/register', { body: { username: userA, email: `x${SUF}@test.dev`, password: pwdA } });
  check('duplicate username rejected (409)', r.status === 409);

  // ---- POSTS ----
  console.log('\n[POSTS]');
  r = await req('POST', '/posts', { token: tA, body: { content: `E2E test post ${SUF} about #deploy and #vercel.` } });
  const postId = r.data?.post?._id;
  check('create post (201)', r.status === 201 && !!postId, `id=${postId}`);

  r = await req('GET', `/posts/${postId}`, { token: tA });
  check('get post (200)', r.status === 200 && r.data?.post?._id === postId);

  r = await req('GET', '/feed/trending?limit=5');
  check('feed trending (200)', r.status === 200 && Array.isArray(r.data?.posts));

  r = await req('GET', '/feed/personalized?limit=5', { token: tA });
  check('feed personalized (200)', r.status === 200 && Array.isArray(r.data?.posts));

  r = await req('PUT', `/posts/${postId}`, { token: tA, body: { content: `E2E updated ${SUF} #vercel` } });
  check('update post (200)', r.status === 200);

  r = await req('POST', `/posts/${postId}/like`, { token: tB });
  const likeCount1 = r.data?.likeCount;
  check('like post (200)', r.status === 200, `likes=${likeCount1}`);
  r = await req('POST', `/posts/${postId}/like`, { token: tB });
  check('unlike post (toggle)', r.data?.likeCount === (likeCount1 === 1 ? 0 : 1));

  r = await req('POST', `/posts/${postId}/bookmark`, { token: tB });
  check('bookmark post (200)', r.status === 200);
  r = await req('POST', `/posts/${postId}/bookmark`, { token: tB });
  check('unbookmark post (200)', r.status === 200);

  r = await req('POST', `/posts/${postId}/share`, { token: tB });
  check('share post (200)', r.status === 200, `shares=${r.data?.shareCount}`);

  r = await req('POST', `/posts/${postId}/comments`, { token: tB, body: { text: 'E2E comment from Beta' } });
  const commentId = r.data?.comment?._id;
  check('create comment (201)', r.status === 201 && !!commentId);

  r = await req('GET', `/posts/${postId}/comments?page=1&limit=10`);
  check('get comments (200)', r.status === 200 && (r.data?.comments?.length || 0) >= 1);

  r = await req('DELETE', `/posts/${postId}/comments/${commentId}`, { token: tB });
  check('delete comment (200)', r.status === 200);

  r = await req('POST', `/admin/posts/${postId}/report`, { token: tA, body: { reason: 'E2E test report' } });
  check('report gated by reputation (403)', r.status === 403 && r.data?.required === 500);

  // ---- USERS / SOCIAL ----
  console.log('\n[USERS]');
  r = await req('GET', `/users/${userA}`);
  check('get user profile (200)', r.status === 200 && r.data?.profile?.username === userA);

  r = await req('POST', `/users/${userB}/follow`, { token: tA });
  check('follow user (200)', r.status === 200);
  r = await req('GET', `/users/${userB}/followers`);
  check('followers list (200)', r.status === 200 && (r.data?.followers || []).some(f => f.username === userA));
  r = await req('DELETE', `/users/${userB}/follow`, { token: tA });
  check('unfollow user (200)', r.status === 200);

  r = await req('PUT', '/users/profile', { token: tA, body: { bio: 'E2E bio updated', displayName: 'E2E Alpha Renamed' } });
  check('update profile (200)', r.status === 200);
  r = await req('GET', `/users/${userA}`);
  check('profile updated (bio set)', r.data?.profile?.bio === 'E2E bio updated');

  r = await req('GET', '/search?q=vercel');
  check('search works (200)', r.status === 200 && Array.isArray(r.data?.posts));

  // ---- SUBSCRIPTIONS / MISC ----
  console.log('\n[SUBSCRIPTIONS & MISC]');
  r = await req('GET', '/subscriptions/status', { token: tA });
  check('subscription status (200)', r.status === 200 && r.data?.subscription?.plan === 'free');

  r = await req('GET', '/sessions', { token: tA });
  check('sessions list (200)', r.status === 200 && (r.data?.sessions?.length || 0) >= 1);

  r = await req('GET', '/notifications', { token: tA });
  check('notifications (200)', r.status === 200);

  r = await req('GET', '/login-logs', { token: tA });
  check('login logs (200)', r.status === 200);

  r = await req('GET', `/reputation/privileges/${aId}`);
  check('reputation privileges (200)', r.status === 200);
  r = await req('GET', `/reputation/history/${aId}`);
  check('reputation history (200)', r.status === 200);
  r = await req('GET', '/reputation/can-transfer', { token: tA });
  check('reputation can-transfer (200)', r.status === 200);

  r = await req('POST', '/support', { token: tA, body: { subject: 'E2E support', category: 'bug', message: 'E2E test ticket' } });
  check('submit support ticket (200)', r.status === 200);
  r = await req('GET', '/support/tickets', { token: tA });
  check('list support tickets (200)', r.status === 200);

  r = await req('GET', '/admin/stats', { token: tA });
  check('admin stats blocked for user (403)', r.status === 403);

  r = await req('POST', '/language/request', { token: tA, body: { language: 'fr' } });
  check('language/request fr -> 503 (email not configured, expected)', r.status === 503, JSON.stringify(r.data));

  // ---- CLEANUP ----
  console.log('\n[CLEANUP]');
  r = await req('DELETE', `/posts/${postId}`, { token: tA });
  check('delete post (200)', r.status === 200);

  // ---- LOGOUT ----
  console.log('\n[LOGOUT]');
  r = await req('POST', '/sessions/logout', { token: tA });
  check('logout (200)', r.status === 200);
  r = await req('GET', '/auth/me', { token: tA });
  check('token revoked after logout (401)', r.status === 401);

  console.log(`\n========== RESULTS: ${passed} passed, ${failed} failed ==========\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('E2E crashed:', e.message); process.exit(1); });
