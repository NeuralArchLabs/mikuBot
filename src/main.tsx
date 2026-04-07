import React from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import App from './App';
import './index.css';
import './utils/animations/emojiAnimations.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}
