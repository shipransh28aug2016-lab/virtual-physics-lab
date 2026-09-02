import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { PreferencesProvider } from '@/app/providers/PreferencesProvider';
import { AppRoutes } from '@/app/routes/AppRoutes';
import '@/styles/lab.css';
import '@/styles/lab-scene.css';

// The portable single-file build runs from file://, where only a hash router
// can resolve routes. The same route table serves both.
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

const host = document.getElementById('root');
if (!host) throw new Error('Root element #root is missing from index.html');

createRoot(host).render(
  <StrictMode>
    <PreferencesProvider>
      <Router>
        <AppRoutes />
      </Router>
    </PreferencesProvider>
  </StrictMode>
);
