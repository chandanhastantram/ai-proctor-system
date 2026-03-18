// Base API URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// WebSocket Base URL
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export const ENDPOINTS = {
  // System Status
  HEALTH: `${API_BASE_URL}/health`,

  // Candidates
  CANDIDATES: {
    REGISTER: `${API_BASE_URL}/api/candidates/`, // POST
    LIST: `${API_BASE_URL}/api/candidates/`, // GET
    GET: (id) => `${API_BASE_URL}/api/candidates/${id}`, // GET
    UPDATE: (id) => `${API_BASE_URL}/api/candidates/${id}`, // PUT
    DELETE: (id) => `${API_BASE_URL}/api/candidates/${id}`, // DELETE
  },

  // Sessions
  SESSIONS: {
    CREATE: `${API_BASE_URL}/api/sessions/`, // POST
    LIST: `${API_BASE_URL}/api/sessions/`, // GET
    GET: (id) => `${API_BASE_URL}/api/sessions/${id}`, // GET
    START: (id) => `${API_BASE_URL}/api/sessions/${id}/start`, // POST
    END: (id) => `${API_BASE_URL}/api/sessions/${id}/end`, // POST
    TERMINATE: (id) => `${API_BASE_URL}/api/sessions/${id}/terminate`, // POST
  },

  // Questions
  QUESTIONS: {
    LIST: `${API_BASE_URL}/api/questions/`, // GET
    NEXT: (sessionId) => `${API_BASE_URL}/api/questions/next/${sessionId}`, // GET
    SUBMIT: `${API_BASE_URL}/api/questions/submit`, // POST
    SESSION_ANSWERS: (sessionId) => `${API_BASE_URL}/api/questions/session/${sessionId}`, // GET
  },

  // Violations
  VIOLATIONS: {
    LOG: `${API_BASE_URL}/api/violations/`, // POST
    SESSION_VIOLATIONS: (sessionId) => `${API_BASE_URL}/api/violations/session/${sessionId}`, // GET
    SESSION_SUMMARY: (sessionId) => `${API_BASE_URL}/api/violations/session/${sessionId}/summary`, // GET
  },

  // Reports
  REPORTS: {
    DASHBOARD: `${API_BASE_URL}/api/reports/dashboard`, // GET
    LEADERBOARD: `${API_BASE_URL}/api/reports/leaderboard`, // GET
    GET: (sessionId) => `${API_BASE_URL}/api/reports/${sessionId}`, // GET
  },

  // WebSocket
  WS: {
    PROCTORING: (sessionId) => `${WS_BASE_URL}/ws/proctor/${sessionId}`, // WS
  }
};
