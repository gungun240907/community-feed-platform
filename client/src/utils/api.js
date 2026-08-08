import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let onUnauthorized = null;
export function setOnUnauthorized(cb) {
  onUnauthorized = cb;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export const feedAPI = {
  getPersonalized: (page = 1, limit = 10, hashtag = '') => {
    const params = { page, limit };
    if (hashtag) params.hashtag = hashtag;
    return api.get('/feed/personalized', { params });
  },
  getTrending: (page = 1, limit = 20) => api.get('/feed/trending', { params: { page, limit } }),
};

export const postAPI = {
  create: (data) => api.post('/posts', data),
  get: (id) => api.get(`/posts/${id}`),
  update: (id, data) => api.put(`/posts/${id}`, data),
  delete: (id) => api.delete(`/posts/${id}`),
  toggleLike: (id) => api.post(`/posts/${id}/like`),
  toggleBookmark: (id) => api.post(`/posts/${id}/bookmark`),
  acceptAnswer: (id, answerId) => api.post(`/posts/${id}/accept-answer`, { answerId }),
  closeVote: (id) => api.post(`/posts/${id}/close-vote`),
  share: (id) => api.post(`/posts/${id}/share`),
  getComments: (id, page = 1, limit = 10) =>
    api.get(`/posts/${id}/comments`, { params: { page, limit } }),
  createComment: (id, data) => api.post(`/posts/${id}/comments`, data),
  deleteComment: (postId, commentId) =>
    api.delete(`/posts/${postId}/comments/${commentId}`),
  report: (id, data) => api.post(`/admin/posts/${id}/report`, data),
};

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verifyLoginOtp: (data) => api.post('/auth/verify-login-otp', data),
  resendLoginOtp: (data) => api.post('/auth/resend-login-otp', data),
  firebaseLogin: (data) => api.post('/auth/firebase-login', data),
  getMe: () => api.get('/auth/me'),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
};

export const otpAPI = {
  request: (data) => api.post('/otp/request', data),
  verify: (data) => api.post('/otp/verify', data),
  resend: (data) => api.post('/otp/resend', data),
  status: (data) => api.post('/otp/status', data),
};

export const userAPI = {
  getProfile: (username) => api.get(`/users/${username}`),
  updateProfile: (data) => api.put('/users/profile', data),
  follow: (username) => api.post(`/users/${username}/follow`),
  unfollow: (username) => api.delete(`/users/${username}/follow`),
  getFollowers: (username) => api.get(`/users/${username}/followers`),
  getFollowing: (username) => api.get(`/users/${username}/following`),
  getUserPosts: (username, page = 1, limit = 10) =>
    api.get(`/users/${username}/posts`, { params: { page, limit } }),
};

export const notificationAPI = {
  getAll: (page = 1, limit = 20, unread = false) =>
    api.get('/notifications', { params: { page, limit, unread } }),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
};

export const searchAPI = {
  search: (query, params = {}) => api.get('/search', { params: { q: query, ...params } }),
};

export const subscriptionAPI = {
  createSubscription: (plan) => api.post('/subscriptions/create-subscription', { plan }),
  verifyPayment: (data) => api.post('/subscriptions/verify-payment', data),
  getStatus: () => api.get('/subscriptions/status'),
  getPayments: (page = 1, limit = 20) => api.get('/subscriptions/payments', { params: { page, limit } }),
  cancel: () => api.post('/subscriptions/cancel'),
  reactivate: () => api.post('/subscriptions/reactivate'),
  devActivate: (plan) => api.post('/subscriptions/dev-activate', { plan }),
};

export const adminAPI = {
  getDashboardStats: () => api.get('/admin/stats'),
  getReportedPosts: () => api.get('/admin/reports'),
  dismissReport: (reportId) => api.put(`/admin/reports/${reportId}/dismiss`),
  deletePost: (postId) => api.delete(`/admin/posts/${postId}`),
  suspendUser: (userId) => api.put(`/admin/users/${userId}/suspend`),
  unsuspendUser: (userId) => api.put(`/admin/users/${userId}/unsuspend`),
};

export const supportAPI = {
  submit: (data) => api.post('/support', data),
  getMyTickets: (page = 1, limit = 20) => api.get('/support/tickets', { params: { page, limit } }),
};

export const languageAPI = {
  request: (language) => api.post('/language/request', { language }),
  verify: (language, payload) => {
    const body = typeof payload === 'string' ? { otp: payload } : { ...payload };
    return api.post('/language/verify', { language, ...body });
  },
};

export const reputationAPI = {
  getHistory: (userId, page = 1, limit = 20) => api.get(`/reputation/history/${userId}`, { params: { page, limit } }),
  getPrivileges: (userId) => api.get(`/reputation/privileges/${userId}`),
  getTransfers: (userId, page = 1, limit = 20) => api.get(`/reputation/transfers/${userId}`, { params: { page, limit } }),
  checkCanTransfer: () => api.get('/reputation/can-transfer'),
  transfer: (data) => api.post('/reputation/transfer', data),
};

export const sessionAPI = {
  getActiveSessions: () => api.get('/sessions'),
  revokeSession: (sessionId) => api.post(`/sessions/revoke/${sessionId}`),
  revokeAllSessions: () => api.post('/sessions/revoke-all'),
  trustDevice: () => api.post('/sessions/trust'),
  logout: () => api.post('/sessions/logout'),
};

export const loginLogAPI = {
  getHistory: (page = 1, limit = 20) => api.get('/login-logs', { params: { page, limit } }),
  getAllLogs: (page = 1, limit = 20, filters = {}) =>
    api.get('/admin/login-logs', { params: { page, limit, ...filters } }),
};

export default api;
