import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from 'recharts'
import {
  Shield, Trophy, CheckCircle, XCircle, AlertTriangle, Clock,
  ChevronRight, BarChart2, ThumbsUp, ThumbsDown, Star, ArrowLeft,
  User, Calendar, Briefcase, Hash
} from 'lucide-react'
import { ENDPOINTS } from '../config/endpoints'

// ── Score ring ─────────────────────────────────────────────────────────────
const ScoreRing = ({ score, label, color }) => {
  const data = [{ value: score, fill: color }, { value: 100 - score, fill: 'rgba(255,255,255,0.05)' }]
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius={45} outerRadius={60} data={data} startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" cornerRadius={8} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{Math.round(score)}</span>
          <span className="text-xs text-slate-400">/ 100</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-slate-300">{label}</p>
    </div>
  )
}

// ── Answer card ────────────────────────────────────────────────────────────
const AnswerCard = ({ answer, index }) => {
  const [expanded, setExpanded] = useState(false)
  const score = answer.score ?? 0
  const scoreColor = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card rounded-[24px] overflow-hidden"
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full p-5 flex items-start gap-4 text-left hover:bg-white/2 transition-colors"
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ backgroundColor: scoreColor + '22', border: `1px solid ${scoreColor}44`, color: scoreColor }}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white mb-1 line-clamp-2">
            {answer.question_text ?? `Question ${index + 1}`}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-500">
              {answer.time_taken_seconds ? `${answer.time_taken_seconds}s taken` : 'Time N/A'}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-bold" style={{ color: scoreColor }}>{Math.round(score)}%</p>
          <p className="text-xs text-slate-500">Score</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-500 flex-shrink-0 mt-1 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-5 pb-5 space-y-3 border-t border-white/5"
        >
          <div className="pt-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Your Answer</p>
              <p className="text-sm text-slate-300 leading-relaxed bg-white/3 rounded-xl p-3">
                {answer.candidate_answer || <span className="italic text-slate-500">No answer provided</span>}
              </p>
            </div>
            {answer.feedback && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">AI Feedback</p>
                <p className="text-sm text-slate-300 leading-relaxed bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3">
                  {answer.feedback}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

// ── Violation badge ────────────────────────────────────────────────────────
const ViolationBadge = ({ type, count }) => (
  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-red-500/5 border border-red-500/10">
    <div className="flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-red-400" />
      <span className="text-sm text-slate-300 capitalize">{type.replace(/_/g, ' ')}</span>
    </div>
    <span className="text-sm font-bold text-red-400">{count}×</span>
  </div>
)

// ── Main component ─────────────────────────────────────────────────────────
const ResultsPage = () => {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(ENDPOINTS.REPORTS.GET(sessionId))
        setReport(res.data)
      } catch (e) {
        if (e.response?.status === 400) {
          setError('Report not available yet — the session may still be in progress.')
        } else {
          setError('Could not load report.')
        }
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [sessionId])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1115]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Generating your report…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1115]">
      <div className="text-center space-y-4 max-w-sm">
        <XCircle className="w-16 h-16 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Report Unavailable</h2>
        <p className="text-slate-400 text-sm">{error}</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-semibold transition-all">
          Return Home
        </button>
      </div>
    </div>
  )

  const { session, candidate, answers, violations, overall_result, summary } = report
  const passed = overall_result === 'PASS'
  const knowledgeScore = session?.total_score ?? 0
  const integrityScore = session?.integrity_score ?? 100

  // Group violations by type
  const violationGroups = violations.reduce((acc, v) => {
    acc[v.violation_type] = (acc[v.violation_type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-[#0f1115] relative">
      {/* Ambient blobs */}
      <div className={`fixed top-0 right-0 w-[50%] h-[50%] rounded-full blur-[150px] pointer-events-none opacity-40 ${
        passed ? 'bg-green-500/10' : 'bg-red-500/10'
      }`} />

      {/* Header */}
      <header className="border-b border-white/5 px-8 py-5 flex items-center gap-4 relative z-10">
        <button onClick={() => navigate('/')}
          className="w-9 h-9 rounded-xl border border-white/10 hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white">AI<span className="text-indigo-400">Proctor</span></span>
          <span className="text-slate-500 text-sm">— Interview Results</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8 relative z-10">
        {/* Result hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`glass-card rounded-[40px] p-10 text-center border ${
            passed
              ? 'border-green-500/20 bg-green-500/3'
              : 'border-red-500/20 bg-red-500/3'
          }`}
        >
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
            passed ? 'bg-green-500/10 border-2 border-green-500/30' : 'bg-red-500/10 border-2 border-red-500/30'
          }`}>
            {passed
              ? <CheckCircle className="w-12 h-12 text-green-400" />
              : <XCircle className="w-12 h-12 text-red-400" />
            }
          </div>

          <h1 className="text-4xl font-bold text-white mb-2">
            {passed ? '🎉 Congratulations!' : 'Interview Complete'}
          </h1>
          <p className={`text-lg font-semibold mb-4 ${passed ? 'text-green-400' : 'text-red-400'}`}>
            Result: {overall_result}
          </p>
          {summary && <p className="text-slate-400 max-w-lg mx-auto text-sm leading-relaxed">{summary}</p>}

          {/* Score rings */}
          <div className="flex justify-center gap-12 mt-8">
            <ScoreRing score={knowledgeScore} label="Knowledge" color="#6366f1" />
            <ScoreRing score={integrityScore} label="Integrity" color={integrityScore >= 70 ? '#22c55e' : '#ef4444'} />
          </div>
        </motion.div>

        {/* Candidate info */}
        <div className="glass-card rounded-[28px] p-6">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" /> Candidate Details
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: User, label: 'Name', value: candidate?.name },
              { icon: Briefcase, label: 'Role', value: candidate?.role },
              { icon: Hash, label: 'Questions', value: answers?.length ?? 0 },
              { icon: AlertTriangle, label: 'Violations', value: violations?.length ?? 0 },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white/3 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-slate-500" />
                  <span className="text-xs text-slate-500">{label}</span>
                </div>
                <p className="font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Answers */}
        {answers?.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-400" /> Answer Review ({answers.length})
            </h2>
            {answers.map((a, i) => <AnswerCard key={a.id} answer={a} index={i} />)}
          </div>
        )}

        {/* Violations */}
        {violations?.length > 0 && (
          <div className="glass-card rounded-[28px] p-6 space-y-4">
            <h2 className="font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" /> Proctoring Violations ({violations.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(violationGroups).map(([type, count]) => (
                <ViolationBadge key={type} type={type} count={count} />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-wrap gap-4 justify-center pt-4">
          <button onClick={() => navigate('/')}
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl transition-all flex items-center gap-2">
            New Interview <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={() => navigate('/admin')}
            className="px-8 py-4 border border-white/10 hover:bg-white/5 text-white font-semibold rounded-2xl transition-all flex items-center gap-2">
            <BarChart2 className="w-5 h-5" /> Admin Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResultsPage
