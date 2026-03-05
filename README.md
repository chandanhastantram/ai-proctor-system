# AI Proctor System

A comprehensive AI-powered proctoring solution with a FastAPI backend and a React (Vite) frontend.

## Features

- **Automated Monitoring**: Leverages AI to ensure integrity during exams.
- **Robust Backend**: Built with Python and FastAPI for high performance.
- **Modern Frontend**: Developed with React and Vite for a seamless user experience.

## Project Structure

```bash
.
├── backend/      # FastAPI server, database, and business logic
├── frontend/     # React frontend (Vite)
└── README.md     # Project documentation
```

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js & npm

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows use `.venv\Scripts\activate`
   pip install -r requirements.txt
   ```
3. Run the backend server:
   ```bash
   fastapi dev main.py
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## License

MIT
