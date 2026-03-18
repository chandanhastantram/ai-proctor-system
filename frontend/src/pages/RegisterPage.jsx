import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Mail, Briefcase, Camera, ArrowRight, CheckCircle, ShieldCheck } from 'lucide-react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000/api'

const RegisterPage = () => {
    const navigate = useNavigate()
    const videoRef = useRef(null)
    const [step, setStep] = useState(1)
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: ''
    })
    const [capturedImage, setCapturedImage] = useState(null)
    const [stream, setStream] = useState(null)

    useEffect(() => {
        if (step === 2) {
            startCamera()
        } else {
            stopCamera()
        }
        return () => stopCamera()
    }, [step])

    const startCamera = async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
            setStream(s)
            if (videoRef.current) videoRef.current.srcObject = s
        } catch (err) {
            console.error("Camera access error:", err)
            alert("Camera access denied. Please allow camera permissions to continue.")
        }
    }

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop())
            setStream(null)
        }
    }

    const capturePhoto = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 640
        canvas.height = 480
        const ctx = canvas.getContext('2d')
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        setCapturedImage(canvas.toDataURL('image/jpeg'))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            // 1. Register candidate
            const candRes = await axios.post(`${API_BASE}/candidates/`, {
                ...formData,
                face_descriptor: capturedImage // For demo, we send the base64 image as descriptor
            })
            const candidateId = candRes.data.id

            // 2. Create session
            const sessRes = await axios.post(`${API_BASE}/sessions/`, {
                candidate_id: candidateId
            })
            
            // 3. Start session
            await axios.post(`${API_BASE}/sessions/${sessRes.data.id}/start`)

            // 4. Navigate to interview
            navigate(`/interview/${sessRes.data.id}`)
        } catch (err) {
            console.error("Registration error:", err)
            alert(err.response?.data?.detail || "Something went wrong during registration.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative">
            {/* Background Blobs */}
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-20%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-xl glass-card rounded-[40px] overflow-hidden relative z-10"
            >
                <div className="p-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <ShieldCheck className="text-white w-5 h-5" />
                        </div>
                        <h2 className="text-2xl font-bold font-heading">Candidate Registration</h2>
                    </div>

                    <div className="flex gap-2 mb-10">
                        {[1, 2].map(i => (
                            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-indigo-500' : 'bg-white/10'}`} />
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.form 
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400 ml-1">Full Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                        <input 
                                            type="text" 
                                            placeholder="John Doe"
                                            className="w-full py-4 pl-12 pr-4 rounded-2xl outline-none"
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400 ml-1">Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                        <input 
                                            type="email" 
                                            placeholder="john@example.com"
                                            className="w-full py-4 pl-12 pr-4 rounded-2xl outline-none"
                                            value={formData.email}
                                            onChange={e => setFormData({...formData, email: e.target.value})}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400 ml-1">Target Role</label>
                                    <div className="relative group">
                                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                        <select 
                                            className="w-full py-4 pl-12 pr-4 rounded-2xl outline-none appearance-none"
                                            value={formData.role}
                                            onChange={e => setFormData({...formData, role: e.target.value})}
                                            required
                                        >
                                            <option value="" disabled>Select a role</option>
                                            <option value="Software Engineer">Software Engineer</option>
                                            <option value="AI Developer">AI Developer</option>
                                            <option value="Data Scientist">Data Scientist</option>
                                            <option value="Python Specialist">Python Specialist</option>
                                        </select>
                                    </div>
                                </div>

                                <button 
                                    type="button"
                                    disabled={!formData.name || !formData.email || !formData.role}
                                    onClick={() => setStep(2)}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl flex items-center justify-center gap-2 mt-4 transition-all"
                                >
                                    Continue to Identity Verify
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </motion.form>
                        ) : (
                            <motion.div 
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col items-center"
                            >
                                <p className="text-slate-400 text-sm text-center mb-8 max-w-xs">
                                    Please capture a clear photo of your face for verification during the session.
                                </p>

                                <div className="w-full aspect-video rounded-[32px] bg-black/40 border border-white/10 overflow-hidden relative mb-8">
                                    {!capturedImage ? (
                                        <video 
                                            ref={videoRef} 
                                            autoPlay 
                                            playsInline 
                                            className="w-full h-full object-cover scale-x-[-1]"
                                        />
                                    ) : (
                                        <img src={capturedImage} className="w-full h-full object-cover scale-x-[-1]" />
                                    )}
                                    <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-[32px] pointer-events-none" />
                                </div>

                                <div className="flex gap-4 w-full">
                                    <button 
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex-1 py-4 border border-white/10 hover:bg-white/5 text-white font-semibold rounded-2xl transition-all"
                                    >
                                        Back
                                    </button>
                                    {!capturedImage ? (
                                        <button 
                                            type="button"
                                            onClick={capturePhoto}
                                            className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                                        >
                                            <Camera className="w-5 h-5" />
                                            Capture Photo
                                        </button>
                                    ) : (
                                        <button 
                                            type="button"
                                            onClick={() => setCapturedImage(null)}
                                            className="flex-1 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-2xl transition-all"
                                        >
                                            Retake
                                        </button>
                                    )}
                                </div>

                                {capturedImage && (
                                    <button 
                                        onClick={handleSubmit}
                                        disabled={isLoading}
                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 mt-4 transition-all"
                                    >
                                        {isLoading ? (
                                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                Confirm & Start Interview
                                                <CheckCircle className="w-5 h-5" />
                                            </>
                                        )}
                                    </button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    )
}

export default RegisterPage
