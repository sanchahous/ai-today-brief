import React from 'react';
import { createRoot } from 'react-dom/client';
import { PrototypeApp } from './PrototypeApp';
import { initAnalytics } from './analytics';
import { initExperiments } from './experiments';
import { collectWebVitals } from './webVitals';
import './prototype.css';

// Analytics boot — no-op until a GA4 Measurement ID is provided.
initAnalytics();
initExperiments();
collectWebVitals();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <PrototypeApp />
    </React.StrictMode>,
  );
}
