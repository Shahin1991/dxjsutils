import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource/atkinson-hyperlegible-mono/400.css';
import '@fontsource/atkinson-hyperlegible-mono/700.css';
import './styles/index.css';
import App from './App';

createRoot(document.getElementById('root')).render(<App />);
