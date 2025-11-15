import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// 1. IMPORT ANT DESIGN CSS
import 'antd/dist/reset.css'; // Ant Design's CSS reset

import './index.css' // Your existing Tailwind CSS
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)