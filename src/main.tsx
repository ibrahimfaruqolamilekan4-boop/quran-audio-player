import React, {StrictMode, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './lib/backgroundAudio';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker with auto-update and periodic revalidation
if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Auto-update to latest deployment smoothly
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        // Check for updates whenever user returns to the app
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });
        window.addEventListener('focus', () => {
          registration.update().catch(() => {});
        });
        // Check every 15 minutes
        setInterval(() => {
          registration.update().catch(() => {});
        }, 15 * 60 * 1000);
      }
    },
  });
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
  errorStack: string | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: null, errorStack: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message, errorStack: error.stack || null };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{color: 'red', padding: '20px', background: 'white', zIndex: 9999, position: 'relative'}}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.errorMessage}</pre>
          <pre>{this.state.errorStack}</pre>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
