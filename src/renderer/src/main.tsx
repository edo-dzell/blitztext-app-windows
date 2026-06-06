import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BestaetigungsProvider } from '@/components/Bestaetigung'
import { HinweisProvider } from '@/components/Hinweis'
import { NavGuardProvider } from '@/components/NavGuard'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HinweisProvider>
      <BestaetigungsProvider>
        <NavGuardProvider>
          <App />
        </NavGuardProvider>
      </BestaetigungsProvider>
    </HinweisProvider>
  </React.StrictMode>
)
