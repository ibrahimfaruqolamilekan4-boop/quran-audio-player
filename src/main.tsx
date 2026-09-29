import React, {StrictMode, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Purge any legacy Service Worker registrations or offline CacheStorage
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
  }
  if ('caches' in window) {
    caches.keys().then(keys => {
      keys.forEach(key => caches.delete(key));
    });
  }
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
