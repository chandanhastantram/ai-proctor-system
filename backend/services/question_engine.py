"""Question Engine — manages question bank and adaptive question selection."""

import random
from models import Difficulty, QuestionCategory


# ── Built-in Question Bank ─────────────────────────────────────────────────
# Each question has: category, difficulty, text, reference_answer, time_limit

QUESTION_BANK = [
    # ── Python ─────────────────────────────────────────────────────────────
    {
        "category": QuestionCategory.PYTHON,
        "difficulty": Difficulty.EASY,
        "text": "What is the difference between a list and a tuple in Python?",
        "reference_answer": "Lists are mutable, meaning their elements can be changed after creation. Tuples are immutable, meaning once created their elements cannot be modified. Lists use square brackets [] while tuples use parentheses (). Tuples are generally faster and use less memory than lists. Tuples can be used as dictionary keys while lists cannot because tuples are hashable.",
        "time_limit_seconds": 90,
    },
    {
        "category": QuestionCategory.PYTHON,
        "difficulty": Difficulty.EASY,
        "text": "What are Python decorators and how do they work?",
        "reference_answer": "Decorators are functions that modify the behavior of other functions or classes. They take a function as input and return a modified function. They use the @decorator syntax placed above a function definition. Decorators are commonly used for logging, authentication, timing, and caching. They work by wrapping the original function inside a wrapper function that adds extra functionality before or after calling the original function.",
        "time_limit_seconds": 120,
    },
    {
        "category": QuestionCategory.PYTHON,
        "difficulty": Difficulty.MEDIUM,
        "text": "Explain Python's Global Interpreter Lock (GIL) and its impact on multithreading.",
        "reference_answer": "The GIL is a mutex that protects access to Python objects, preventing multiple native threads from executing Python bytecodes simultaneously. This means only one thread can execute Python code at a time in CPython. The GIL makes CPU-bound multithreaded programs slower because threads cannot truly run in parallel. For I/O-bound tasks, multithreading still works well because threads release the GIL during I/O operations. To achieve true CPU parallelism, you can use multiprocessing, which creates separate Python processes each with their own GIL.",
        "time_limit_seconds": 120,
    },
    {
        "category": QuestionCategory.PYTHON,
        "difficulty": Difficulty.MEDIUM,
        "text": "What are generators in Python? How do they differ from regular functions?",
        "reference_answer": "Generators are special functions that use the yield keyword instead of return. They generate values lazily one at a time instead of computing all values at once and storing them in memory. When a generator function is called, it returns a generator object without executing the body. Each call to next() executes until the next yield statement. Generators are memory-efficient for large datasets because they compute values on-the-fly. They maintain their state between successive calls.",
        "time_limit_seconds": 120,
    },
    {
        "category": QuestionCategory.PYTHON,
        "difficulty": Difficulty.HARD,
        "text": "Explain metaclasses in Python. When would you use them?",
        "reference_answer": "Metaclasses are classes that define how other classes behave — they are the class of a class. The default metaclass is 'type'. You can create custom metaclasses by inheriting from type and overriding __new__ or __init__. Metaclasses are used to modify class creation, enforce coding standards, register classes automatically, add methods or attributes to classes, implement ORMs like Django models or SQLAlchemy, and create APIs that use class definitions as schema. They intercept the class creation process and can modify the class before it is created.",
        "time_limit_seconds": 180,
    },

    # ── Machine Learning ───────────────────────────────────────────────────
    {
        "category": QuestionCategory.MACHINE_LEARNING,
        "difficulty": Difficulty.EASY,
        "text": "What is the difference between supervised and unsupervised learning?",
        "reference_answer": "Supervised learning uses labeled data where input-output pairs are provided for training. The model learns to map inputs to known outputs. Examples include classification and regression. Unsupervised learning uses unlabeled data where the model must find patterns and structures on its own. Examples include clustering, dimensionality reduction, and anomaly detection. Supervised learning requires human effort to label data while unsupervised does not.",
        "time_limit_seconds": 90,
    },
    {
        "category": QuestionCategory.MACHINE_LEARNING,
        "difficulty": Difficulty.EASY,
        "text": "What is overfitting and how can you prevent it?",
        "reference_answer": "Overfitting occurs when a model learns the training data too well, including noise, and fails to generalize to new unseen data. The model has high accuracy on training data but poor performance on test data. Prevention techniques include: cross-validation, regularization (L1/L2), dropout in neural networks, early stopping, reducing model complexity, increasing training data, data augmentation, and ensemble methods like bagging and boosting.",
        "time_limit_seconds": 120,
    },
    {
        "category": QuestionCategory.MACHINE_LEARNING,
        "difficulty": Difficulty.MEDIUM,
        "text": "Explain the bias-variance tradeoff in machine learning.",
        "reference_answer": "Bias is the error from oversimplified assumptions in the model causing it to miss relevant patterns (underfitting). Variance is the error from sensitivity to small fluctuations in the training data causing the model to learn noise (overfitting). High bias means the model is too simple. High variance means the model is too complex. The tradeoff is that decreasing bias often increases variance and vice versa. The goal is to find the sweet spot that minimizes total error. Techniques like cross-validation, regularization, and ensemble methods help balance this tradeoff.",
        "time_limit_seconds": 120,
    },
    {
        "category": QuestionCategory.MACHINE_LEARNING,
        "difficulty": Difficulty.MEDIUM,
        "text": "What is gradient descent? Explain the difference between batch, stochastic, and mini-batch gradient descent.",
        "reference_answer": "Gradient descent is an optimization algorithm used to minimize the loss function by iteratively moving in the direction of steepest descent defined by the negative of the gradient. Batch gradient descent computes the gradient using the entire dataset which is stable but slow for large datasets. Stochastic gradient descent (SGD) computes the gradient using a single sample which is fast but noisy. Mini-batch gradient descent computes the gradient using a small batch of samples, combining the benefits of both approaches. Mini-batch is the most commonly used in practice with typical batch sizes of 32-256.",
        "time_limit_seconds": 120,
    },
    {
        "category": QuestionCategory.MACHINE_LEARNING,
        "difficulty": Difficulty.HARD,
        "text": "Explain how transformers work. What is self-attention and why is it important?",
        "reference_answer": "Transformers are neural network architectures that process sequences using self-attention mechanisms instead of recurrence. Self-attention allows each element in a sequence to attend to all other elements, computing a weighted sum based on relevance. It uses Query, Key, and Value matrices. Attention scores are computed as softmax(QK^T / sqrt(d_k)) * V. Multi-head attention runs multiple attention operations in parallel to capture different types of relationships. Transformers enable parallelization unlike RNNs, handle long-range dependencies better, and are the basis for models like BERT, GPT, and T5. Positional encoding is added since the architecture has no inherent notion of sequence order.",
        "time_limit_seconds": 180,
    },
    {
        "category": QuestionCategory.MACHINE_LEARNING,
        "difficulty": Difficulty.HARD,
        "text": "Explain the difference between generative and discriminative models. Give examples of each.",
        "reference_answer": "Discriminative models learn the decision boundary between classes by modeling P(y|x) directly — the probability of the output given the input. Examples include logistic regression, SVM, neural networks, and random forests. Generative models learn the joint probability distribution P(x,y) or P(x) and can generate new data samples. Examples include Naive Bayes, GANs, VAEs, Hidden Markov Models, and Gaussian Mixture Models. Discriminative models generally perform better for classification tasks while generative models can generate new data, handle missing data, and model the data distribution itself.",
        "time_limit_seconds": 150,
    },

    # ── Data Structures & Algorithms ───────────────────────────────────────
    {
        "category": QuestionCategory.DATA_STRUCTURES,
        "difficulty": Difficulty.EASY,
        "text": "What is the difference between a stack and a queue? Give real-world examples.",
        "reference_answer": "A stack follows Last-In-First-Out (LIFO) principle where the last element added is the first one removed. Like a stack of plates. Operations: push and pop. Used in function call stacks, undo operations, expression evaluation. A queue follows First-In-First-Out (FIFO) principle where the first element added is the first one removed. Like a line of people waiting. Operations: enqueue and dequeue. Used in task scheduling, BFS traversal, print job queues, and message queues.",
        "time_limit_seconds": 90,
    },
    {
        "category": QuestionCategory.DATA_STRUCTURES,
        "difficulty": Difficulty.MEDIUM,
        "text": "Explain hash tables. What are collisions and how do you handle them?",
        "reference_answer": "Hash tables store key-value pairs using a hash function that maps keys to array indices for O(1) average lookup, insertion, and deletion. Collisions occur when two different keys hash to the same index. Collision handling methods include: chaining (linked list at each bucket), open addressing (probing for next empty slot using linear, quadratic, or double hashing), and Robin Hood hashing. Load factor (number of entries / number of buckets) affects performance. When load factor exceeds a threshold, the table is resized. Worst-case time complexity is O(n) but amortized average is O(1).",
        "time_limit_seconds": 120,
    },
    {
        "category": QuestionCategory.DATA_STRUCTURES,
        "difficulty": Difficulty.HARD,
        "text": "Explain the time complexity of common operations on a balanced BST vs a hash table. When would you choose one over the other?",
        "reference_answer": "Balanced BST (AVL, Red-Black): search, insert, delete are all O(log n). Elements are stored in sorted order enabling efficient range queries, finding min/max, and in-order traversal. Hash table: search, insert, delete are O(1) average, O(n) worst case. No ordering of elements. Choose BST when you need sorted data, range queries, predecessor/successor queries, or guaranteed worst-case performance. Choose hash table when you need fastest average-case lookups and don't need ordering. BSTs use more memory per element (pointers) while hash tables may waste memory on empty buckets.",
        "time_limit_seconds": 150,
    },

    # ── System Design ──────────────────────────────────────────────────────
    {
        "category": QuestionCategory.SYSTEM_DESIGN,
        "difficulty": Difficulty.EASY,
        "text": "What is a REST API? What are the main HTTP methods and when do you use each?",
        "reference_answer": "REST (Representational State Transfer) is an architectural style for designing networked applications using HTTP. It uses stateless communication with standard HTTP methods. GET retrieves resources without side effects. POST creates new resources. PUT replaces an entire resource. PATCH partially updates a resource. DELETE removes a resource. REST APIs use URLs to identify resources, HTTP status codes for response status, and typically JSON for data format. Key principles include statelessness, client-server separation, uniform interface, and cacheability.",
        "time_limit_seconds": 120,
    },
    {
        "category": QuestionCategory.SYSTEM_DESIGN,
        "difficulty": Difficulty.MEDIUM,
        "text": "How would you design a rate limiter for an API?",
        "reference_answer": "A rate limiter controls the number of requests a client can make in a given time window. Common algorithms include Token Bucket (tokens added at fixed rate, each request consumes a token), Sliding Window Log (stores timestamps of requests), Sliding Window Counter (combines fixed and sliding window approaches), and Leaky Bucket (requests processed at fixed rate). Implementation choices: in-memory (Redis) for distributed systems, or local for single server. Key considerations include identifying clients by IP, API key, or user ID, returning 429 status codes when limit exceeded, including rate limit headers in responses, and handling distributed rate limiting across multiple servers.",
        "time_limit_seconds": 150,
    },
    {
        "category": QuestionCategory.SYSTEM_DESIGN,
        "difficulty": Difficulty.HARD,
        "text": "Design a real-time notification system that can handle millions of users.",
        "reference_answer": "Use WebSockets or Server-Sent Events (SSE) for real-time push. Architecture: API servers receive notification events and publish to a message queue (Kafka/RabbitMQ). Notification service consumes from queue and routes to appropriate channels (push, email, SMS, in-app). Use Redis pub/sub for real-time in-app notifications. Store notifications in a database (Cassandra for write-heavy workload). WebSocket servers maintain connections with clients. Use a connection registry (Redis) to track which server each user is connected to. For scalability: horizontal scaling of WebSocket servers behind a load balancer, partition users across servers, use fan-out pattern for group notifications. Include delivery tracking, retry logic, and priority queues.",
        "time_limit_seconds": 180,
    },

    # ── SQL ─────────────────────────────────────────────────────────────────
    {
        "category": QuestionCategory.SQL,
        "difficulty": Difficulty.EASY,
        "text": "What is the difference between INNER JOIN, LEFT JOIN, RIGHT JOIN, and FULL OUTER JOIN?",
        "reference_answer": "INNER JOIN returns only rows that have matching values in both tables. LEFT JOIN returns all rows from the left table and matched rows from the right table, with NULL for non-matching right rows. RIGHT JOIN returns all rows from the right table and matched rows from the left table, with NULL for non-matching left rows. FULL OUTER JOIN returns all rows from both tables, with NULL where there is no match on either side. INNER JOIN is the most restrictive, FULL OUTER JOIN is the most inclusive.",
        "time_limit_seconds": 90,
    },
    {
        "category": QuestionCategory.SQL,
        "difficulty": Difficulty.MEDIUM,
        "text": "What are database indexes? How do they improve query performance and what are the tradeoffs?",
        "reference_answer": "Indexes are data structures (typically B-trees or hash tables) that speed up data retrieval by maintaining a sorted reference to table rows. They improve SELECT query performance by avoiding full table scans. Tradeoffs: indexes slow down INSERT, UPDATE, DELETE operations because the index must also be updated. Indexes consume additional disk space. Types include single-column, composite (multi-column), unique, partial, and covering indexes. Use indexes on columns frequently used in WHERE clauses, JOIN conditions, and ORDER BY. Avoid over-indexing tables with heavy write operations. Query execution plans (EXPLAIN) help determine if indexes are being used effectively.",
        "time_limit_seconds": 120,
    },
    {
        "category": QuestionCategory.SQL,
        "difficulty": Difficulty.HARD,
        "text": "Explain database normalization. What are the first three normal forms and when might you denormalize?",
        "reference_answer": "Normalization organizes data to reduce redundancy and improve integrity. 1NF: each column contains atomic values, no repeating groups. 2NF: meets 1NF and all non-key columns fully depend on the entire primary key (no partial dependencies). 3NF: meets 2NF and no non-key column depends on another non-key column (no transitive dependencies). Denormalization intentionally adds redundancy for performance. Reasons to denormalize: reducing complex joins in read-heavy systems, improving query performance for reporting/analytics, caching computed values. Common denormalization techniques: adding redundant columns, pre-computed aggregates, materialized views. The decision depends on read vs write ratio and performance requirements.",
        "time_limit_seconds": 150,
    },

    # ── General / Behavioral ───────────────────────────────────────────────
    {
        "category": QuestionCategory.GENERAL,
        "difficulty": Difficulty.EASY,
        "text": "What is version control and why is Git important for software development?",
        "reference_answer": "Version control is a system that tracks changes to files over time, allowing developers to collaborate, revert to previous versions, and maintain a history of changes. Git is a distributed version control system where every developer has a complete copy of the repository. Key features include branching and merging for parallel development, commit history for tracking changes, staging area for selective commits, and support for distributed collaboration. Git enables code review through pull requests, continuous integration and deployment, experimentation through branches, and team collaboration without conflicts. Platforms like GitHub and GitLab add features like issue tracking and project management.",
        "time_limit_seconds": 90,
    },
    {
        "category": QuestionCategory.GENERAL,
        "difficulty": Difficulty.MEDIUM,
        "text": "Explain the concept of CI/CD. How does it improve software development?",
        "reference_answer": "CI (Continuous Integration) automatically builds and tests code whenever changes are pushed to a repository. CD (Continuous Delivery/Deployment) automatically deploys tested code to staging or production environments. CI catches bugs early by running automated tests on every commit. CD speeds up the release cycle by automating deployment. Key components include a version control system, build server (Jenkins, GitHub Actions, GitLab CI), automated test suite, and deployment pipeline. Benefits: faster feedback loops, fewer integration issues, more frequent releases, consistent deployment process, and reduced manual errors. Best practices include maintaining a comprehensive test suite, keeping the build fast, and deploying to production-like staging environments.",
        "time_limit_seconds": 120,
    },
]


def _normalize_val(val):
    """Convert enum or string to its string value for comparison."""
    return val.value if hasattr(val, 'value') else val


def get_next_question(
    difficulty,
    category=None,
    asked_indices: list[int] | None = None,
) -> dict | None:
    """Select the next question based on difficulty and category.

    Args:
        difficulty: Target difficulty level (Difficulty enum or string)
        category: Optional category filter (QuestionCategory enum or string)
        asked_indices: Indices of previously asked questions to avoid repeats

    Returns:
        A question dict or None if no questions available
    """
    if asked_indices is None:
        asked_indices = []

    target_diff = _normalize_val(difficulty)
    target_cat = _normalize_val(category) if category else None

    candidates = []
    for idx, q in enumerate(QUESTION_BANK):
        if idx in asked_indices:
            continue
        if _normalize_val(q["difficulty"]) != target_diff:
            continue
        if target_cat and _normalize_val(q["category"]) != target_cat:
            continue
        candidates.append((idx, q))

    if not candidates:
        # Fallback: try any difficulty in the same category
        for idx, q in enumerate(QUESTION_BANK):
            if idx in asked_indices:
                continue
            if target_cat and _normalize_val(q["category"]) != target_cat:
                continue
            candidates.append((idx, q))

    if not candidates:
        # Fallback: try any available question
        for idx, q in enumerate(QUESTION_BANK):
            if idx not in asked_indices:
                candidates.append((idx, q))

    if not candidates:
        return None

    idx, question = random.choice(candidates)
    return {**question, "_bank_index": idx}


def adjust_difficulty(current, score: float) -> Difficulty:
    """Adjust difficulty based on the candidate's answer score.

    Args:
        current: Current difficulty level (Difficulty enum or string like 'easy')
        score: Score (0-100) from the last answer

    Returns:
        Updated difficulty level (Difficulty enum)
    """
    current_val = _normalize_val(current)

    if score >= 75:
        # Good answer → increase difficulty
        if current_val == Difficulty.EASY.value:
            return Difficulty.MEDIUM
        elif current_val == Difficulty.MEDIUM.value:
            return Difficulty.HARD
        return Difficulty.HARD
    elif score <= 35:
        # Poor answer → decrease difficulty
        if current_val == Difficulty.HARD.value:
            return Difficulty.MEDIUM
        elif current_val == Difficulty.MEDIUM.value:
            return Difficulty.EASY
        return Difficulty.EASY
    else:
        # Return as Difficulty enum
        try:
            return Difficulty(current_val)
        except ValueError:
            return Difficulty.EASY

