import React from 'react';
import ReactDOM from 'react-dom/client'; // Обратите внимание на использование 'react-dom/client'
import App from './App';
import './index.css';

// Используем createRoot вместо render
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
