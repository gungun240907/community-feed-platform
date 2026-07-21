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
  getTrending: (limit = 20) => api.get('/feed/trending', { params: { limit } }),
};

export const postAPI = {
  create: (data) => api.post('/posts', data),
  get: (id) => api.get(`/posts/${id}`),
  update: (id, data) => api.put(`/posts/${id}`, data),
  delete: (id) => api.delete(`/posts/${id}`),
  toggleLike: (id) => api.post(`/posts/${id}/like`),
  toggleBookmark: (id) => api.post(`/posts/${id}/bookmark`),
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
  getMe: () => api.get('/auth/me'),
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

export const adminAPI = {
  getDashboardStats: () => api.get('/admin/stats'),
  getReportedPosts: () => api.get('/admin/reports'),
  dismissReport: (reportId) => api.put(`/admin/reports/${reportId}/dismiss`),
  deletePost: (postId) => api.delete(`/admin/posts/${postId}`),
  suspendUser: (userId) => api.put(`/admin/users/${userId}/suspend`),
  unsuspendUser: (userId) => api.put(`/admin/users/${userId}/unsuspend`),
};

export default api;
