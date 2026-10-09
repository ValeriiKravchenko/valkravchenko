import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { TrainersApp } from './TrainersApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TrainersApp />
  </StrictMode>,
)
