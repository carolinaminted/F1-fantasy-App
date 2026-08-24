import './styles/index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext.tsx';
import EnvironmentBadge from './components/EnvironmentBadge.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
        <EnvironmentBadge />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
