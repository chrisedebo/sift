# Contributing to Sift 🤝

We love your input! We want to make contributing to Sift as easy and transparent as possible, whether it's:
- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

## Development Setup 🛠️

### 1. Local Environment
If you prefer running components locally (instead of via Docker):
- **Backend:**
  ```bash
  cd backend
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  uvicorn main:app --reload
  ```
- **Frontend:**
  ```bash
  cd frontend
  npm install
  npm run dev
  ```

### 2. Code Style & Architecture
- **Backend (Python):** 
  - Use `async/await` for I/O operations and database queries.
  - Enforce Pydantic typing for all request/response schemas.
  - Follow the dependency injection pattern in FastAPI.
- **Frontend (TypeScript):** 
  - Adhere to the glass-morphism neon design aesthetic (`globals.css`). Use `.glass-panel` and `.futuristic-btn` classes.
  - Handle all errors with proper typing (`catch (err: unknown)`).
- **Database Rules:**
  - DO NOT construct dynamic SQL strings. Always use SQLAlchemy ORM parameters.
  - For tests, always use an isolated `test_db`.

## Pull Request Process 🚀

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure the test suite passes (`make test`).
4. Ensure your code follows the styling rules in `AGENTS.md`.
5. Issue that pull request!

## Any questions?
Feel free to open an issue to discuss your ideas before writing any code.
