import { useState, useEffect, useRef, useCallback } from 'react';

export default function useInfiniteScroll(fetchFn, options = {}) {
  const {
    initialPage = 1,
    limit = 10,
    enabled = true,
    filter = {},
  } = options;

  const [data, setData] = useState([]);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [sentinel, setSentinel] = useState(null);
  const hasMoreRef = useRef(hasMore);
  const isLoadingRef = useRef(isLoading);

  hasMoreRef.current = hasMore;
  isLoadingRef.current = isLoading;

  const loadData = useCallback(
    async (pageNum, append = true) => {
      if (!enabled) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchFn(pageNum, limit, filter);
        const newPosts = response.data.posts;
        const pagination = response.data.pagination;

        setData((prev) => {
          const combined = append ? [...prev, ...newPosts] : newPosts;
          const seen = new Set();
          return combined.filter((p) => {
            if (!p?._id || seen.has(p._id)) return false;
            seen.add(p._id);
            return true;
          });
        });
        setHasMore(pagination ? pagination.hasMore : newPosts.length === limit);
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to load feed');
        if (!append) setData([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [fetchFn, limit, enabled, filter]
  );

  useEffect(() => {
    if (page === 1) {
      loadData(1, false);
    } else {
      loadData(page, true);
    }
  }, [page, loadData]);

  useEffect(() => {
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !isLoadingRef.current) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setPage(1);
    setHasMore(true);
  }, []);

  const appendPost = useCallback((post) => {
    setData((prev) => [post, ...prev]);
  }, []);

  const removePost = useCallback((postId) => {
    setData((prev) => prev.filter((p) => p._id !== postId));
  }, []);

  const updatePost = useCallback((postId, updates) => {
    setData((prev) =>
      prev.map((p) => (p._id === postId ? { ...p, ...updates } : p))
    );
  }, []);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    hasMore,
    lastElementRef: setSentinel,
    refresh,
    appendPost,
    removePost,
    updatePost,
    setData,
  };
}
