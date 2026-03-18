import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Users, Zap, CheckCircle, ArrowRight } from 'lucide-react'

const LandingPage = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 relative z-10 border-b border-white/5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold font-heading tracking-tight">AI<span className="text-indigo-500">Proctor</span></span>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Documentation</button>
          <button 
            onClick={() => navigate('/admin')}
            className="text-sm font-medium px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-all"
          >
            Admin Portal
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-8 pt-20 pb-32 relative z-10">
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-8"
          >
            <Zap className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Now powered by MediaPipe AI</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-6xl md:text-7xl font-bold font-heading mb-6 tracking-tight max-w-4xl"
          >
            The Next Generation of <br />
            <span className="gradient-text">Remote Proctoring.</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-slate-400 mb-12 max-w-2xl leading-relaxed"
          >
            Secure, automated, and intelligent interviews. AI Proctor ensures 
            fairness through real-time eye tracking, face detection, and 
            advanced audio analysis.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <button 
              onClick={() => navigate('/register')}
              className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-2 group transition-all"
            >
              Get Started
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold transition-all">
              Watch Demo
            </button>
          </motion.div>
        </div>

        {/* Features Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32"
        >
          {[
            { 
              icon: Shield, 
              title: "Eye Tracking", 
              desc: "MediaPipe-powered gaze detection ensures candidates stay focused on the screen." 
            },
            { 
              icon: Zap, 
              title: "Instant Scoring", 
              desc: "NLP-driven evaluation gives immediate feedback on answer quality." 
            },
            { 
              icon: Users, 
              title: "Multi-face Detection", 
              desc: "Flags immediately if unauthorized persons enter the frame." 
            }
          ].map((feature, i) => (
            <div key={i} className="glass-card p-8 rounded-[32px] group hover:border-indigo-500/30 transition-all cursor-default">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-all">
                <feature.icon className="text-indigo-400 w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed text-sm">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 text-center text-slate-500 text-sm mt-20">
        <p>© 2026 AI Proctoring System. Built for Secure & Fair Evaluations.</p>
      </footer>
    </div>
  )
}

export default LandingPage
