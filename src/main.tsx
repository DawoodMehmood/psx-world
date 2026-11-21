import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

// ?assets opens the dev-only asset gallery instead of the city (see SPEC backlog).
if (import.meta.env.DEV && new URLSearchParams(location.search).has('assets')) {
  void import('./gallery/Gallery').then(({ Gallery }) =>
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <Gallery />
        </ErrorBoundary>
      </StrictMode>,
    ),
  );
} else {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
