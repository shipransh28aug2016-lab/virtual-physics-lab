import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { PreferencesProvider } from '@/app/providers/PreferencesProvider';
import { AppRoutes } from '@/app/routes/AppRoutes';
import '@/styles/lab.css';
import '@/styles/lab-scene.css';

// The portable single-file build runs from file://, where only a hash router
// can resolve routes. The same route table serves both.
const isFile = window.location.protocol === 'file:';
const Router = isFile ? HashRouter : BrowserRouter;
// The site is served under a subpath (GitHub Pages project page). Without this,
// a direct link or a page refresh on any route but the home page 404s, because
// BrowserRouter otherwise matches routes against the full pathname including
// that subpath. The portable file has no subpath to strip.
const basename = isFile ? undefined : import.meta.env.BASE_URL;

const host = document.getElementById('root');
if (!host) throw new Error('Root element #root is missing from index.html');

createRoot(host).render(
  <StrictMode>
    <PreferencesProvider>
      <Router basename={basename} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </Router>
    </PreferencesProvider>
  </StrictMode>
);
