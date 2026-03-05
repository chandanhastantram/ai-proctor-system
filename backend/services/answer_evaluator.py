"""Answer Evaluator — uses NLP (TF-IDF + cosine similarity) to score answers."""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re


def preprocess_text(text: str) -> str:
    """Clean and normalize text for comparison."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text


def evaluate_answer(candidate_answer: str, reference_answer: str) -> dict:
    """Evaluate a candidate's answer against the reference answer using TF-IDF cosine similarity.

    Args:
        candidate_answer: The answer submitted by the candidate
        reference_answer: The ideal reference answer

    Returns:
        dict with keys: score (0-100), feedback (str), similarity (float)
    """
    if not candidate_answer or not candidate_answer.strip():
        return {
            "score": 0.0,
            "feedback": "No answer was provided.",
            "similarity": 0.0,
        }

    # Preprocess
    clean_candidate = preprocess_text(candidate_answer)
    clean_reference = preprocess_text(reference_answer)

    if not clean_candidate:
        return {
            "score": 0.0,
            "feedback": "Your answer was empty or contained no meaningful content.",
            "similarity": 0.0,
        }

    # TF-IDF Vectorization
    vectorizer = TfidfVectorizer(
        stop_words="english",
        max_features=5000,
        ngram_range=(1, 2),  # Unigrams and bigrams
    )

    try:
        tfidf_matrix = vectorizer.fit_transform([clean_reference, clean_candidate])
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
    except ValueError:
        # Edge case: if vectorizer produces empty vocabulary
        similarity = 0.0

    # Convert cosine similarity to a 0-100 score with adjusted scaling
    # Raw cosine similarity tends to be low for text, so we scale it
    raw_score = similarity * 100

    # Apply a generous curve: even partially correct answers should get some score
    if raw_score >= 60:
        score = min(95, raw_score + 10)
    elif raw_score >= 40:
        score = raw_score + 15
    elif raw_score >= 20:
        score = raw_score + 10
    elif raw_score >= 10:
        score = raw_score + 5
    else:
        score = raw_score

    score = round(min(100, max(0, score)), 1)

    # Generate feedback based on score
    feedback = _generate_feedback(score, candidate_answer, reference_answer)

    return {
        "score": score,
        "feedback": feedback,
        "similarity": round(similarity, 4),
    }


def _generate_feedback(score: float, candidate: str, reference: str) -> str:
    """Generate human-readable feedback based on the score."""
    # Check answer length relative to reference
    candidate_words = len(candidate.split())
    reference_words = len(reference.split())
    length_ratio = candidate_words / max(reference_words, 1)

    feedback_parts = []

    if score >= 80:
        feedback_parts.append("Excellent answer! You covered the key concepts well.")
    elif score >= 60:
        feedback_parts.append("Good answer with solid coverage of the main points.")
    elif score >= 40:
        feedback_parts.append("Adequate answer but some important aspects were missing.")
    elif score >= 20:
        feedback_parts.append("Your answer touched on the topic but lacked depth and key details.")
    else:
        feedback_parts.append("Your answer did not adequately address the question.")

    if length_ratio < 0.3:
        feedback_parts.append("Consider providing more detailed explanations.")
    elif length_ratio > 2.5:
        feedback_parts.append("Try to be more concise while covering the essential points.")

    return " ".join(feedback_parts)


def evaluate_batch(answers: list[dict]) -> list[dict]:
    """Evaluate multiple answers at once.

    Args:
        answers: List of dicts with 'candidate_answer' and 'reference_answer' keys

    Returns:
        List of evaluation results
    """
    return [
        evaluate_answer(a["candidate_answer"], a["reference_answer"])
        for a in answers
    ]
