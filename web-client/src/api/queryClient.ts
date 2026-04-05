import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 минут
      cacheTime: 1000 * 60 * 10, // 10 минут
      retry: 1,
    },
  },
});