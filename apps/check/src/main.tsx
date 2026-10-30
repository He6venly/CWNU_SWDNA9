import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './CheckApp.tsx'
import './style.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
