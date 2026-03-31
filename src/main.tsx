import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {invoke} from '@tauri-apps/api/core';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

invoke('close_splashscreen').catch(console.error);
