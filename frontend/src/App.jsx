import React, { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

// Lazy load pages for performance
const LandingPage = lazy(() => import('./pages/LandingPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const InterviewRoom = lazy(() => import('./pages/InterviewRoom'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const ResultsPage = lazy(() => import('./pages/ResultsPage'))

// Simple loading spinner
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-vh-100 bg-[#0f1115]">
    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
  </div>
)

const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-[#0f1115] text-[#e0e0e0] selection:bg-indigo-500/30">
        <Suspense fallback={<LoadingSpinner />}>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/interview/:sessionId" element={<InterviewRoom />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/results/:sessionId" element={<ResultsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </div>
    </Router>
  )
}

export default App
