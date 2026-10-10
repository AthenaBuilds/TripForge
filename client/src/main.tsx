import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { AppProviders, createQueryClient } from './providers';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders client={createQueryClient()}>
        <App />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
