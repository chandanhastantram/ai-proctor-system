import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'
import {
  Shield, Users, Activity, AlertTriangle, Trophy, TrendingUp, RefreshCw,
  CheckCircle, XCircle, Clock, ChevronRight, Eye, Award, BarChart2
} from 'lucide-react'
import { ENDPOINTS } from '../config/endpoints'

// ── Colour palette ─────────────────────────────────────────────────────────
const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

// ── Helper: stat card ──────────────────────────────────────────────────────
const StatCard = ({ title, value, sub, icon: Icon, color = 'indigo', trend }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="glass-card rounded-[28px] p-6 space-y-3"
  >
    <div className="flex items-start justify-between">
      <div className={`w-12 h-12 rounded-2xl bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center`}>
        <Icon className={`w-6 h-6 text-${color}-400`} />
      </div>
      {trend !== undefined && (
        <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${trend >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div>
      <p className="text-3xl font-bold text-white">{value ?? '—'}</p>
      <p className="text-sm font-semibold text-white mt-0.5">{title}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  </motion.div>
)

// ── Custom tooltip for recharts ────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1d27] border border-white/10 px-3 py-2.5 rounded-xl shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

// ── Session row ────────────────────────────────────────────────────────────
const SessionRow = ({ session, onView }) => {
  const statusColors = {
    completed: 'text-green-400 bg-green-500/10 border-green-500/20',
    terminated: 'text-red-400 bg-red-500/10 border-red-500/20',
    active: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    pending: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  }
  const color = statusColors[session.status] ?? statusColors.pending
  const scoreColor = session.total_score >= 70 ? 'text-green-400' : session.total_score >= 40 ? 'text-yellow-400' : 'text-red-400'
  const intColor = session.integrity_score >= 70 ? 'text-green-400' : session.integrity_score >= 40 ? 'text-yellow-400' : 'text-red-400'

  return (
    <tr className="border-b border-white/5 hover:bg-white/2 transition-colors">
      <td className="py-3 px-4 text-sm text-slate-300 font-mono">{session.id?.slice(0, 8)}…</td>
      <td className="py-3 px-4">
        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border capitalize ${color}`}>
          {session.status}
        </span>
      </td>
      <td className={`py-3 px-4 text-sm font-bold ${scoreColor}`}>{Math.round(session.total_score ?? 0)}%</td>
      <td className={`py-3 px-4 text-sm font-bold ${intColor}`}>{Math.round(session.integrity_score ?? 100)}%</td>
      <td className="py-3 px-4 text-xs text-slate-500">
        {session.started_at ? new Date(session.started_at).toLocaleString() : '—'}
      </td>
      <td className="py-3 px-4">
        {(session.status === 'completed' || session.status === 'terminated') && (
          <button
            onClick={() => onView(session.id)}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
          >
            View <Eye className="w-3 h-3" />
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [sessions, setSessions] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  const load = async () => {
    setLoading(true)
    try {
      const [dashRes, sessRes, lbRes] = await Promise.all([
        axios.get(ENDPOINTS.REPORTS.DASHBOARD),
        axios.get(ENDPOINTS.SESSIONS.LIST),
        axios.get(ENDPOINTS.REPORTS.LEADERBOARD),
      ])
      setDashboard(dashRes.data)
      setSessions(sessRes.data)
      setLeaderboard(lbRes.data.leaderboard ?? [])
    } catch (e) {
      console.error('Dashboard error', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Derived chart data
  const statusChartData = dashboard ? [
    { name: 'Completed', value: dashboard.completed_sessions, fill: '#22c55e' },
    { name: 'Terminated', value: dashboard.terminated_sessions, fill: '#ef4444' },
    { name: 'Active', value: dashboard.active_sessions, fill: '#f59e0b' },
  ].filter(d => d.value > 0) : []

  const passFailData = dashboard ? [
    { name: 'Passed', value: dashboard.pass_count, fill: '#6366f1' },
    { name: 'Failed', value: dashboard.fail_count, fill: '#94a3b8' },
  ] : []

  const scoreCategories = leaderboard.slice(0, 6).map(c => ({
    name: c.name.split(' ')[0],
    score: Math.round(c.avg_score),
    integrity: Math.round(c.avg_integrity),
  }))

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'sessions', label: 'Sessions', icon: Activity },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  ]

  return (
    <div className="min-h-screen bg-[#0f1115]">
      {/* Ambient blobs */}
      <div className="fixed top-0 left-0 w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-white/5 px-8 py-5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-white">AI<span className="text-indigo-400">Proctor</span></span>
            <span className="text-xs text-slate-500 ml-2">Admin Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-slate-400 hover:text-white text-sm transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => navigate('/')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all">
            ← Back to Home
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-8 relative z-10">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-white/5 pb-4">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Total Candidates" value={dashboard?.total_candidates} icon={Users} color="indigo" />
              <StatCard title="Total Sessions" value={dashboard?.total_sessions} icon={Activity} color="purple" />
              <StatCard title="Passed" value={dashboard?.pass_count}
                sub={`${dashboard?.fail_count ?? 0} failed`} icon={CheckCircle} color="green" />
              <StatCard title="Total Violations" value={dashboard?.total_violations} icon={AlertTriangle} color="red" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Avg Knowledge Score" value={`${dashboard?.avg_knowledge_score ?? 0}%`}
                icon={TrendingUp} color="cyan" />
              <StatCard title="Avg Integrity Score" value={`${dashboard?.avg_integrity_score ?? 0}%`}
                icon={Shield} color="green" />
              <StatCard title="Highest Score" value={`${dashboard?.highest_score ?? 0}%`}
                icon={Award} color="yellow" />
              <StatCard title="Active Now" value={dashboard?.active_sessions}
                icon={Activity} color="purple" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Session status pie */}
              <div className="glass-card rounded-[28px] p-6">
                <h3 className="text-base font-bold text-white mb-6">Session Status</h3>
                {statusChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                        paddingAngle={4} dataKey="value">
                        {statusChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend formatter={(v) => <span className="text-slate-400 text-xs">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-60 flex items-center justify-center text-slate-500 text-sm">No data yet</div>
                )}
              </div>

              {/* Pass/fail bar */}
              <div className="glass-card rounded-[28px] p-6">
                <h3 className="text-base font-bold text-white mb-6">Candidate Results</h3>
                {leaderboard.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={scoreCategories} barSize={12}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="score" name="Score" fill="#6366f1" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="integrity" name="Integrity" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-60 flex items-center justify-center text-slate-500 text-sm">No completed sessions yet</div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Sessions tab */}
        {tab === 'sessions' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="glass-card rounded-[28px] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-bold text-white">All Sessions</h3>
                <span className="text-xs text-slate-500">{sessions.length} total</span>
              </div>
              {loading ? (
                <div className="p-8 text-center text-slate-500 text-sm">Loading…</div>
              ) : sessions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No sessions yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        {['Session ID', 'Status', 'Score', 'Integrity', 'Started', 'Report'].map(h => (
                          <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map(s => (
                        <SessionRow key={s.id} session={s} onView={id => navigate(`/results/${id}`)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Leaderboard tab */}
        {tab === 'leaderboard' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="glass-card rounded-[28px] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5">
                <h3 className="font-bold text-white">Top Candidates</h3>
              </div>
              {leaderboard.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No results yet.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {leaderboard.map((c, i) => (
                    <div key={c.candidate_id}
                      className="px-6 py-4 flex items-center gap-4 hover:bg-white/2 transition-colors">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg ${
                        i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                        i === 1 ? 'bg-slate-400/20 text-slate-300' :
                        i === 2 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-white/5 text-slate-500'
                      }`}>
                        {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.email} · {c.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-indigo-400">{Math.round(c.avg_score)}%</p>
                        <p className="text-xs text-slate-500">Knowledge</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-400">{Math.round(c.avg_integrity)}%</p>
                        <p className="text-xs text-slate-500">Integrity</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-300">{c.session_count}</p>
                        <p className="text-xs text-slate-500">Sessions</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default AdminDashboard
