"""Report Generator — creates comprehensive session reports."""

from models import InterviewSession, Violation, Answer


def generate_report(
    session: InterviewSession,
    answers: list,
    violations: list,
) -> dict:
    """Generate a comprehensive session report.

    Args:
        session: The interview session ORM object
        answers: List of Answer ORM objects
        violations: List of Violation ORM objects

    Returns:
        dict with report data
    """
    # Calculate answer statistics
    total_answers = len(answers)
    if total_answers > 0:
        avg_score = sum(a.score for a in answers) / total_answers
        highest_score = max(a.score for a in answers)
        lowest_score = min(a.score for a in answers)
    else:
        avg_score = 0.0
        highest_score = 0.0
        lowest_score = 0.0

    # Calculate violation statistics
    total_violations = len(violations)
    violation_breakdown = {}
    for v in violations:
        vtype = v.violation_type.value if hasattr(v.violation_type, 'value') else str(v.violation_type)
        violation_breakdown[vtype] = violation_breakdown.get(vtype, 0) + 1

    # Severity score
    severity_total = sum(v.severity for v in violations)
    max_severity = total_violations * 3  # Max severity is 3 per violation

    # Determine overall result
    integrity = session.integrity_score
    knowledge_score = avg_score

    if integrity >= 70 and knowledge_score >= 50:
        overall_result = "PASS"
    elif integrity >= 50 and knowledge_score >= 60:
        overall_result = "PASS"
    else:
        overall_result = "FAIL"

    # Generate summary
    summary_parts = []
    summary_parts.append(
        f"Candidate answered {total_answers} questions with an average score of {avg_score:.1f}%."
    )

    if total_violations == 0:
        summary_parts.append("No integrity violations were detected during the session.")
    else:
        summary_parts.append(
            f"{total_violations} integrity violation(s) were detected, "
            f"resulting in an integrity score of {integrity:.1f}%."
        )

    if overall_result == "PASS":
        summary_parts.append("Overall result: PASS. The candidate demonstrated satisfactory knowledge and maintained acceptable integrity.")
    else:
        reasons = []
        if knowledge_score < 50:
            reasons.append("insufficient knowledge score")
        if integrity < 50:
            reasons.append("low integrity score due to multiple violations")
        summary_parts.append(
            f"Overall result: FAIL. Reason: {', '.join(reasons)}."
        )

    return {
        "overall_result": overall_result,
        "summary": " ".join(summary_parts),
        "statistics": {
            "total_questions": total_answers,
            "average_score": round(avg_score, 1),
            "highest_score": round(highest_score, 1),
            "lowest_score": round(lowest_score, 1),
            "total_violations": total_violations,
            "violation_breakdown": violation_breakdown,
            "integrity_score": round(integrity, 1),
            "severity_total": severity_total,
        },
    }
