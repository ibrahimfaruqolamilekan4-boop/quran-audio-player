import React, {StrictMode, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './lib/backgroundAudio';
import { registerSW } from 'virtual:pwa-register';

/**
 * Checks if Quran recitation or ambient audio is actively playing.
 */
function isAudioPlaying(): boolean {
  if ((window as any).__quranAudioPlaying) return true;
  const audioElements = Array.from(document.querySelectorAll('audio'));
  return audioElements.some(a => !a.paused && !a.ended && a.currentTime > 0);
}

/**
 * Displays a non-intrusive Medina Emerald update banner.
 * Never forces a page reload while recitation audio is playing.
 */
function showUpdateNotification(onRefresh: () => void) {
  if (document.getElementById('pwa-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-update-banner';
  banner.setAttribute('role', 'alert');
  banner.style.cssText = `
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 12px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 99999;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: #0C2A20;
    color: #F6F1E4;
    border: 1px solid rgba(31, 138, 106, 0.5);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 0 15px rgba(31, 138, 106, 0.3);
    border-radius: 9999px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    font-weight: 500;
    max-width: 90vw;
  `;

  const textSpan = document.createElement('span');
  textSpan.textContent = '✨ New update available';

  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = 'Tap to refresh';
  refreshBtn.style.cssText = `
    background: #1F8A6A;
    color: #FFFFFF;
    border: none;
    padding: 5px 12px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  `;
  refreshBtn.onmouseenter = () => { refreshBtn.style.background = '#27A37E'; };
  refreshBtn.onmouseleave = () => { refreshBtn.style.background = '#1F8A6A'; };

  refreshBtn.onclick = () => {
    onRefresh();
  };

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: #A9B7A6;
    font-size: 14px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  `;
  closeBtn.onclick = () => {
    banner.remove();
  };

  banner.appendChild(textSpan);
  banner.appendChild(refreshBtn);
  banner.appendChild(closeBtn);
  document.body.appendChild(banner);
}

// Register PWA service worker with audio-safe updates
if ('serviceWorker' in navigator) {
  let pendingUpdate = false;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      pendingUpdate = true;

      // Always display non-intrusive "Tap to refresh" banner
      showUpdateNotification(() => {
        updateSW(true);
      });

      // If audio is currently playing, NEVER reload automatically!
      if (isAudioPlaying()) {
        console.log('[PWA] Update available, deferring reload because recitation audio is actively playing.');
        return;
      }
    },
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        // Check for updates when returning to the app
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });
        window.addEventListener('focus', () => {
          registration.update().catch(() => {});
        });
        // Check periodically (every 15 min)
        setInterval(() => {
          registration.update().catch(() => {});
        }, 15 * 60 * 1000);
      }
    },
  });

  // Listen for audio paused/ended to prompt or safely refresh if pending
  window.addEventListener('quran-audio-paused', () => {
    if (pendingUpdate && !isAudioPlaying()) {
      showUpdateNotification(() => {
        updateSW(true);
      });
    }
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
  </StrictMode>
);
