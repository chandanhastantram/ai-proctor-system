"""Proctoring Service — processes browser events and determines violations.

Enhancements over v1:
  - Warning tiers: 3 warnings before first violation log for low-severity events
  - Per-event severity escalation after 5 occurrences
  - Heartbeat (ping) passthrough
  - Session summary endpoint helper
  - Configurable thresholds
"""

import time
from models import ViolationType


# ── Event mapping ────────────────────────────────────────────────────────────

EVENT_TYPE_MAP = {
    "tab_switch":      {"type": ViolationType.TAB_SWITCH,      "severity": 2, "description": "Candidate switched browser tabs."},
    "no_face":         {"type": ViolationType.NO_FACE,          "severity": 2, "description": "No face detected in camera frame."},
    "multiple_faces":  {"type": ViolationType.MULTIPLE_FACES,   "severity": 3, "description": "Multiple faces detected in camera frame."},
    "looking_away":    {"type": ViolationType.LOOKING_AWAY,     "severity": 1, "description": "Candidate looking away from screen."},
    "audio_detected":  {"type": ViolationType.AUDIO_DETECTED,   "severity": 2, "description": "Suspicious audio activity detected."},
    "face_mismatch":   {"type": ViolationType.FACE_MISMATCH,    "severity": 3, "description": "Face does not match registered candidate."},
    "copy_paste":      {"type": ViolationType.COPY_PASTE,       "severity": 2, "description": "Copy/paste or keyboard shortcut detected."},
    "window_blur":     {"type": ViolationType.COPY_PASTE,       "severity": 1, "description": "Browser window lost focus."},
}

# ── Cooldowns (seconds) — prevent event spam ─────────────────────────────────

EVENT_COOLDOWNS = {
    "tab_switch":      5,
    "no_face":         10,
    "multiple_faces":  12,
    "looking_away":    4,
    "audio_detected":  10,
    "face_mismatch":   30,
    "copy_paste":      5,
    "window_blur":     5,
}

# ── Warning tier: events that need N warnings before logging a violation ──────
# These are events that happen frequently and should be warned first.

WARNING_BEFORE_LOG = {
    "looking_away":  3,   # 3 occurrences → then log violation
    "window_blur":   2,   # 2 occurrences → then log violation
}

# ── Severity penalties and terminate threshold ────────────────────────────────

SEVERITY_PENALTIES = {
    1: 3.0,
    2: 7.0,
    3: 15.0,
}

TERMINATE_THRESHOLD = 20.0


# ── Session tracker ───────────────────────────────────────────────────────────

class SessionTracker:
    """Tracks cooldowns, warning counts, event history for a single session."""

    def __init__(self):
        self.last_event_time:  dict[str, float] = {}
        self.event_counts:     dict[str, int]   = {}
        self.warning_counts:   dict[str, int]   = {}   # pre-violation warnings
        self.total_violations: int = 0

    def can_log(self, event_type: str) -> bool:
        """Check if enough time has passed since the last event of this type."""
        cooldown  = EVENT_COOLDOWNS.get(event_type, 5)
        last_time = self.last_event_time.get(event_type, 0)
        return (time.time() - last_time) >= cooldown

    def should_warn_only(self, event_type: str) -> bool:
        """Return True if we should issue a warning instead of a real violation.

        For events in WARNING_BEFORE_LOG, we accumulate warning_counts until
        the threshold is hit, then log a proper violation.
        """
        threshold = WARNING_BEFORE_LOG.get(event_type)
        if threshold is None:
            return False   # no warning gate for this event type

        current = self.warning_counts.get(event_type, 0)
        self.warning_counts[event_type] = current + 1

        # Below threshold → issue warning only
        return self.warning_counts[event_type] < threshold

    def record(self, event_type: str):
        """Record that a *real* violation was logged."""
        self.last_event_time[event_type] = time.time()
        self.event_counts[event_type] = self.event_counts.get(event_type, 0) + 1
        self.total_violations += 1
        # Reset warning counter after a real violation is logged
        self.warning_counts[event_type] = 0

    def get_summary(self) -> dict:
        return {
            "total_violations": self.total_violations,
            "event_counts":     dict(self.event_counts),
            "warning_counts":   dict(self.warning_counts),
        }


# ── Registry ─────────────────────────────────────────────────────────────────

_session_trackers: dict[str, SessionTracker] = {}


def get_tracker(session_id: str) -> SessionTracker:
    """Get or create a tracker for a session."""
    if session_id not in _session_trackers:
        _session_trackers[session_id] = SessionTracker()
    return _session_trackers[session_id]


def clear_tracker(session_id: str):
    """Remove tracking data when a session ends."""
    _session_trackers.pop(session_id, None)


def get_session_summary(session_id: str) -> dict | None:
    """Return current tracker summary without modifying state."""
    tracker = _session_trackers.get(session_id)
    if not tracker:
        return None
    return tracker.get_summary()


# ── Main processing function ──────────────────────────────────────────────────

def process_event(
    session_id: str,
    event_type: str,
    event_data: dict | None = None,
) -> dict | None:
    """Process an incoming proctoring event.

    Args:
        session_id: The session UUID as a string
        event_type: Type of event (e.g. 'tab_switch', 'no_face')
        event_data: Optional extra data from the frontend

    Returns:
        dict with violation info if a violation should be logged,
        {"status": "warning", "warning_count": N} if in warning tier,
        or None if suppressed by cooldown / unknown event / ping.
    """
    # Passthrough — ping is a heartbeat, not a violation
    if event_type == "ping":
        return None

    mapping = EVENT_TYPE_MAP.get(event_type)
    if not mapping:
        return None

    tracker = get_tracker(session_id)

    # Check cooldown
    if not tracker.can_log(event_type):
        return None

    # Check warning tier
    if tracker.should_warn_only(event_type):
        wc = tracker.warning_counts.get(event_type, 1)
        threshold = WARNING_BEFORE_LOG.get(event_type, 1)
        return {
            "status": "warning",
            "event_type": event_type,
            "warning_count": wc,
            "warnings_until_violation": threshold - wc,
        }

    # Build violation info
    description = mapping["description"]
    if event_data and event_data.get("detail"):
        description = f"{description} Detail: {event_data['detail']}"

    severity = mapping["severity"]
    # Escalate severity if repeated ≥5 times
    count = tracker.event_counts.get(event_type, 0)
    if count >= 5:
        severity = min(3, severity + 1)

    tracker.record(event_type)

    return {
        "status": "violation",
        "violation_type": mapping["type"].value,
        "description":    description,
        "severity":       severity,
        "penalty":        SEVERITY_PENALTIES.get(severity, 5.0),
        "event_count":    tracker.event_counts[event_type],
        "total_violations": tracker.total_violations,
    }
