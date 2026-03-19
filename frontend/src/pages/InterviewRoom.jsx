import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import {
  Shield, Camera, CameraOff, Mic, MicOff, AlertTriangle,
  Clock, CheckCircle, XCircle, ChevronRight, Eye, EyeOff,
  Wifi, WifiOff, Send, RotateCcw, Volume2, VolumeX, Users, User
} from 'lucide-react'
import { ENDPOINTS } from '../config/endpoints'
import { useProctoringEngine } from '../hooks/useProctoringEngine'

// ── Timer hook ───────────────────────────────────────────────────────────────

function useTimer(seconds, onExpire) {
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef(null)

  const reset = useCallback((newSeconds) => {
    clearInterval(intervalRef.current)
    setRemaining(newSeconds ?? seconds)
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          onExpire?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [seconds, onExpire])

  const stop = useCallback(() => clearInterval(intervalRef.current), [])
  useEffect(() => () => clearInterval(intervalRef.current), [])
  return { remaining, reset, stop }
}

// ── Status badge ─────────────────────────────────────────────────────────────

const WSBadge = ({ connected }) => (
  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
    connected
      ? 'bg-green-500/10 border-green-500/30 text-green-400'
      : 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'
  }`}>
    {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
    {connected ? 'Live' : 'Reconnecting'}
  </div>
)

// ── Integrity bar ────────────────────────────────────────────────────────────

const IntegrityBar = ({ score }) => {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400 font-medium">Integrity</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{Math.round(score)}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          animate={{ width: `${score}%` }}
          transition={{ type: 'spring', stiffness: 80 }}
          className="h-full rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
        />
      </div>
    </div>
  )
}

// ── Audio level meter ────────────────────────────────────────────────────────

const AudioMeter = ({ level, isSpeaking, isWhispering, micEnabled }) => {
  const bars = 12
  const filledBars = Math.round((level / 100) * bars)
  const barColor = isSpeaking ? '#ef4444' : isWhispering ? '#f59e0b' : '#6366f1'

  return (
    <div className="flex items-center gap-1.5">
      {micEnabled ? (
        <Volume2 className={`w-3.5 h-3.5 flex-shrink-0 ${isSpeaking ? 'text-red-400' : isWhispering ? 'text-yellow-400' : 'text-slate-500'}`} />
      ) : (
        <VolumeX className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
      )}
      <div className="flex gap-px items-end h-4">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className="w-1 rounded-sm transition-all duration-100"
            style={{
              height: `${25 + (i / bars) * 75}%`,
              backgroundColor: i < filledBars ? barColor : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </div>
      {isSpeaking && <span className="text-xs text-red-400 font-semibold">Speech!</span>}
      {isWhispering && !isSpeaking && <span className="text-xs text-yellow-400 font-semibold">Audio</span>}
    </div>
  )
}

// ── Proctoring status indicators ─────────────────────────────────────────────

const DetectionStatus = ({ faceCount, gazeDirection, isLookingAway, audioLevel, isSpeaking, isWhispering, micEnabled }) => {
  const faceOk = faceCount === 1
  const faceColor = faceCount === 0 ? 'text-red-400' : faceCount >= 2 ? 'text-red-400' : 'text-green-400'
  const faceLabel = faceCount === 0 ? 'No Face' : faceCount >= 2 ? `${faceCount} Faces!` : '1 Face ✓'
  const gazeOk = !isLookingAway
  const gazeLabel = isLookingAway ? `Looking ${gazeDirection}` : 'On Screen ✓'

  return (
    <div className="space-y-2">
      {/* Face */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <User className={`w-3.5 h-3.5 ${faceColor}`} />
          <span className="text-xs text-slate-400">Face</span>
        </div>
        <span className={`text-xs font-semibold ${faceColor}`}>{faceLabel}</span>
      </div>

      {/* Gaze */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Eye className={`w-3.5 h-3.5 ${gazeOk ? 'text-green-400' : 'text-yellow-400'}`} />
          <span className="text-xs text-slate-400">Gaze</span>
        </div>
        <span className={`text-xs font-semibold ${gazeOk ? 'text-green-400' : 'text-yellow-400'}`}>
          {gazeLabel}
        </span>
      </div>

      {/* Audio */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {micEnabled
            ? <Mic className={`w-3.5 h-3.5 ${isSpeaking ? 'text-red-400' : 'text-slate-400'}`} />
            : <MicOff className="w-3.5 h-3.5 text-slate-600" />
          }
          <span className="text-xs text-slate-400">Audio</span>
        </div>
        <AudioMeter level={audioLevel} isSpeaking={isSpeaking} isWhispering={isWhispering} micEnabled={micEnabled} />
      </div>
    </div>
  )
}

// ── Camera overlay (face box + gaze indicator) ────────────────────────────────

const CameraOverlay = ({ faceCount, boundingBox, isLookingAway, gazeDirection, cameraEnabled }) => {
  if (!cameraEnabled) return null

  const boxColor = faceCount === 0
    ? '#ef4444'
    : faceCount >= 2 ? '#f59e0b' : '#22c55e'

  return (
    <>
      {/* Face bounding box */}
      {boundingBox && faceCount === 1 && (
        <div
          className="absolute pointer-events-none rounded-lg transition-all duration-300"
          style={{
            // Mirror because video is flipped
            left:   `${(1 - boundingBox.xCenter - boundingBox.width / 2) * 100}%`,
            top:    `${(boundingBox.yCenter - boundingBox.height / 2) * 100}%`,
            width:  `${boundingBox.width * 100}%`,
            height: `${boundingBox.height * 100}%`,
            border: `2px solid ${boxColor}`,
            boxShadow: `0 0 10px ${boxColor}60`,
          }}
        />
      )}

      {/* Violation flash overlay */}
      <AnimatePresence>
        {faceCount === 0 && (
          <motion.div
            key="no-face"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0, 0.4, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 bg-red-500/30 pointer-events-none rounded-2xl"
          />
        )}
        {faceCount >= 2 && (
          <motion.div
            key="multi-face"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="absolute inset-0 bg-orange-500/30 pointer-events-none rounded-2xl"
          />
        )}
      </AnimatePresence>

      {/* Gaze direction arrow */}
      {isLookingAway && (
        <div className="absolute top-2 right-2 bg-yellow-500/80 text-black text-xs font-bold px-2 py-0.5 rounded-lg backdrop-blur-sm">
          {gazeDirection === 'left'  ? '← Looking Left' :
           gazeDirection === 'right' ? 'Looking Right →' :
           gazeDirection === 'up'    ? '↑ Looking Up' : '↓ Looking Down'}
        </div>
      )}

      {/* Status dot */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full animate-pulse ${
          faceCount === 1 ? 'bg-red-500' : faceCount === 0 ? 'bg-red-400 animate-ping' : 'bg-orange-500'
        }`} />
        <span className="text-xs text-slate-300 font-medium">LIVE</span>
      </div>
    </>
  )
}

// ── Violation toast ──────────────────────────────────────────────────────────

const ViolationToast = ({ violation, onDismiss }) => (
  <motion.div
    initial={{ x: 120, opacity: 0, scale: 0.95 }}
    animate={{ x: 0, opacity: 1, scale: 1 }}
    exit={{ x: 120, opacity: 0 }}
    className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 backdrop-blur-xl max-w-xs shadow-2xl"
  >
    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-red-300 capitalize">
        {violation.violation_type?.replace(/_/g, ' ')}
      </p>
      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{violation.description}</p>
      <p className="text-xs text-slate-600 mt-1">Integrity: {Math.round(violation.integrity_score)}%</p>
    </div>
    <button onClick={onDismiss} className="text-slate-600 hover:text-white flex-shrink-0 transition-colors mt-0.5">
      <XCircle className="w-4 h-4" />
    </button>
  </motion.div>
)

// ── Main Component ────────────────────────────────────────────────────────────

const InterviewRoom = () => {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  // Session / question state
  const [session, setSession]         = useState(null)
  const [question, setQuestion]       = useState(null)
  const [answer, setAnswer]           = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [questionNumber, setQuestionNumber] = useState(0)
  const [isFinished, setIsFinished]   = useState(false)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  const videoRef = useRef(null)

  // Stable ref so the timer's onExpire always calls the latest handleSubmit
  const handleSubmitRef = useRef(null)

  // ── Proctoring engine (all 5 channels) ────────────────────────────────────
  const {
    integrityScore, wsConnected, violations, isTerminated,
    cameraEnabled, faceCount, boundingBox, gazeDirection,
    isLookingAway, audioLevel, isSpeaking, isWhispering, micEnabled,
    startCamera, stopAll,
  } = useProctoringEngine({
    sessionId,
    videoRef,
    onViolation: () => {},
    onTerminated: () => {
      endSessionApi('terminate')
    },
  })

  // ── Timer ─────────────────────────────────────────────────────────────────
  const { remaining: timeLeft, reset: resetTimer, stop: stopTimer } = useTimer(
    120,
    useCallback(() => handleSubmitRef.current?.(true), [])
  )

  // ── API helpers ───────────────────────────────────────────────────────────

  const fetchNextQuestion = useCallback(async () => {
    try {
      const res = await axios.get(ENDPOINTS.QUESTIONS.NEXT(sessionId))
      setQuestion(res.data)
      setAnswer('')
      resetTimer(res.data.time_limit_seconds ?? 120)
      setQuestionNumber(n => n + 1)
    } catch (err) {
      if (err.response?.status === 404) {
        setIsFinished(true)
        stopTimer()
        endSessionApi('end')
      } else {
        setError('Could not load next question.')
      }
    }
  }, [sessionId, resetTimer, stopTimer])

  // Keep the ref pointing at the latest handleSubmit on every render
  // (the timer's onExpire callback reads it via handleSubmitRef.current)
  async function handleSubmit(isTimeout = false) {
    if (!question || isSubmitting) return
    setIsSubmitting(true)
    stopTimer()
    try {
      await axios.post(ENDPOINTS.QUESTIONS.SUBMIT, {
        session_id: sessionId,
        question_id: question.id,
        candidate_answer: isTimeout ? '[Time expired — no answer submitted]' : answer,
        time_taken_seconds: (question.time_limit_seconds ?? 120) - timeLeft,
      })
    } catch (e) {
      console.error('Submit error', e)
    } finally {
      setIsSubmitting(false)
      await fetchNextQuestion()
    }
  }
  handleSubmitRef.current = handleSubmit

  async function endSessionApi(action) {
    try {
      const url = action === 'end'
        ? ENDPOINTS.SESSIONS.END(sessionId)
        : ENDPOINTS.SESSIONS.TERMINATE(sessionId)
      await axios.post(url)
    } catch (e) {
      console.error('End session error', e)
    }
  }

  // ── Initialization ─────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      try {
        const res = await axios.get(ENDPOINTS.SESSIONS.GET(sessionId))
        setSession(res.data)
        await startCamera()
        await fetchNextQuestion()
      } catch {
        setError('Could not initialize interview session.')
      } finally {
        setLoading(false)
      }
    }
    init()
    return () => { stopAll(); stopTimer() }
  }, [])

  const handleFinish = () => {
    stopAll()
    stopTimer()
    navigate(`/results/${sessionId}`)
  }

  // ── Rendered states ─────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1115]">
      <div className="text-center space-y-4">
        <div className="relative mx-auto w-16 h-16">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <Shield className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto" />
        </div>
        <div>
          <p className="text-white font-semibold">Initializing AI Proctor</p>
          <p className="text-slate-500 text-xs mt-1">Loading face detection models…</p>
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1115]">
      <div className="text-center space-y-4">
        <XCircle className="w-16 h-16 text-red-400 mx-auto" />
        <h2 className="text-2xl font-bold text-white">Error</h2>
        <p className="text-slate-400">{error}</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-semibold transition-all">
          Return Home
        </button>
      </div>
    </div>
  )

  if (isTerminated) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1115]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="text-center space-y-6 max-w-md mx-auto p-8">
        <div className="w-28 h-28 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto">
          <XCircle className="w-14 h-14 text-red-400" />
        </div>
        <h2 className="text-3xl font-bold text-white">Session Terminated</h2>
        <p className="text-slate-400">Too many proctoring violations were detected. Integrity dropped to <span className="text-red-400 font-bold">{Math.round(integrityScore)}%</span>.</p>
        <button onClick={handleFinish} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-semibold transition-all">
          View Results
        </button>
      </motion.div>
    </div>
  )

  if (isFinished) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1115]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="text-center space-y-6 max-w-md mx-auto p-8">
        <div className="w-28 h-28 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto">
          <CheckCircle className="w-14 h-14 text-green-400" />
        </div>
        <h2 className="text-3xl font-bold text-white">Interview Complete!</h2>
        <p className="text-slate-400">All questions answered. Generating your results…</p>
        <button onClick={handleFinish} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-semibold transition-all flex items-center gap-2 mx-auto">
          View Results <ChevronRight className="w-5 h-5" />
        </button>
      </motion.div>
    </div>
  )

  const timerRed    = timeLeft <= 10
  const timerYellow = timeLeft <= 30 && !timerRed
  const timerColor  = timerRed ? 'text-red-400' : timerYellow ? 'text-yellow-400' : 'text-green-400'
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60

  return (
    <div className="min-h-screen bg-[#0f1115] flex flex-col select-none"
      onCopy={e => e.preventDefault()}
      onPaste={e => e.preventDefault()}
      onCut={e => e.preventDefault()}
    >
      {/* Violation toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-auto">
        <AnimatePresence>
          {violations.map(v => (
            <ViolationToast key={v.id} violation={v}
              onDismiss={() => {}} />
          ))}
        </AnimatePresence>
      </div>

      {/* Warning: no face */}
      <AnimatePresence>
        {faceCount === 0 && !loading && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-40 bg-red-500/90 backdrop-blur text-white text-center py-2 text-sm font-bold flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            No face detected! Please look at the camera.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Multiple faces warning */}
      <AnimatePresence>
        {faceCount >= 2 && !loading && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-40 bg-orange-500/90 backdrop-blur text-white text-center py-2 text-sm font-bold flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4" />
            Multiple faces detected! Only the candidate should be visible.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-white/5 px-6 py-3.5 flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white">AI<span className="text-indigo-400">Proctor</span></span>
          <span className="text-slate-600 text-sm hidden sm:block">— Interview Room</span>
        </div>
        <div className="flex items-center gap-3">
          <WSBadge connected={wsConnected} />
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold font-mono ${
            timerRed    ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse' :
            timerYellow ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                          'bg-white/5 border-white/10 text-green-400'
          }`}>
            <Clock className="w-3.5 h-3.5" />
            {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left sidebar */}
        <aside className="w-60 border-r border-white/5 p-4 flex flex-col gap-3 bg-[#0d1017] overflow-y-auto flex-shrink-0">

          {/* Camera feed */}
          <div className="rounded-2xl overflow-hidden bg-black/60 border border-white/10 aspect-video relative">
            {cameraEnabled ? (
              <video ref={videoRef} autoPlay playsInline muted
                className="w-full h-full object-cover scale-x-[-1]" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <CameraOff className="w-8 h-8 text-slate-600" />
                <p className="text-xs text-slate-600">Camera off</p>
              </div>
            )}
            <CameraOverlay
              faceCount={faceCount}
              boundingBox={boundingBox}
              isLookingAway={isLookingAway}
              gazeDirection={gazeDirection}
              cameraEnabled={cameraEnabled}
            />
          </div>

          {/* Integrity score */}
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <IntegrityBar score={integrityScore} />
            <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-y-2 text-xs">
              <span className="text-slate-500">Question</span>
              <span className="text-white font-semibold text-right">{questionNumber}</span>
              <span className="text-slate-500">Difficulty</span>
              <span className={`font-semibold text-right capitalize ${
                question?.difficulty === 'easy' ? 'text-green-400' :
                question?.difficulty === 'hard' ? 'text-red-400' : 'text-yellow-400'
              }`}>{question?.difficulty ?? '—'}</span>
            </div>
          </div>

          {/* Detection status */}
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">AI Detection</p>
            <DetectionStatus
              faceCount={faceCount}
              gazeDirection={gazeDirection}
              isLookingAway={isLookingAway}
              audioLevel={audioLevel}
              isSpeaking={isSpeaking}
              isWhispering={isWhispering}
              micEnabled={micEnabled}
            />
          </div>

          {/* Rules */}
          <div className="glass-card rounded-2xl p-4 space-y-1.5">
            <p className="text-xs font-semibold text-slate-400 mb-2">Ground Rules</p>
            {[
              '✋ Stay visible on camera',
              '👁️ Look at screen at all times',
              '🔇 No speaking or background noise',
              '📋 No copy/paste allowed',
              '🚫 No other people in frame',
              '🖥️ No tab switching',
            ].map(rule => (
              <p key={rule} className="text-xs text-slate-600 leading-relaxed">{rule}</p>
            ))}
          </div>
        </aside>

        {/* Question area */}
        <main className="flex-1 flex flex-col p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {question && (
              <motion.div key={question.id}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}
                className="max-w-3xl mx-auto w-full space-y-5"
              >
                {/* Tags */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
                    {question.category?.replace(/_/g, ' ')}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    question.difficulty === 'easy' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                    question.difficulty === 'medium' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                    'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>{question.difficulty}</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs font-medium">
                    Q{questionNumber}
                  </span>
                </div>

                {/* Question */}
                <div className="glass-card rounded-[28px] p-7">
                  <h2 className="text-xl font-bold text-white leading-relaxed">{question.text}</h2>
                </div>

                {/* Answer */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Your Answer</label>
                  <textarea
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    placeholder="Type your detailed answer here…"
                    rows={9}
                    className="w-full p-5 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-slate-700 resize-none outline-none focus:border-indigo-500/50 transition-all text-sm leading-relaxed font-mono"
                  />
                  <p className="text-xs text-slate-700 text-right">{answer.length} chars</p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={!answer.trim() || isSubmitting}
                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all text-sm"
                  >
                    {isSubmitting
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Send className="w-4 h-4" /> Submit Answer</>
                    }
                  </button>
                  <button
                    onClick={() => handleSubmit(true)}
                    className="px-5 py-4 border border-white/10 hover:bg-white/5 text-slate-500 hover:text-white rounded-2xl transition-all text-sm flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" /> Skip
                  </button>
                </div>

                <p className="text-xs text-slate-700 text-center">
                  Answer auto-submits when timer hits 00:00
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

export default InterviewRoom
