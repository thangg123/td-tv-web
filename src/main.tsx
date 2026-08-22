import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import '@/styles/theme.css';

/**
 * One client for the whole app.
 *
 * `staleTime` is set per query rather than here, because the four kinds of data
 * this app reads go stale on wildly different schedules (see lib/queries).
 * What is global is the failure policy: two retries with a backoff, and never a
 * refetch on window focus — a poster grid re-fetching every time the viewer
 * alt-tabs back is pure waste on a catalogue that changes hourly.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      gcTime: 30 * 60_000,
    },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
