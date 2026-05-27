
# PennyWise.wtf (Watch The Finance)


A full-stack microservices application demonstrating modern DevSecOps practices with AI-powered financial analysis.

## Tech Stack

### Backend Services
- **API Gateway**: Node.js + Express
  - JWT Authentication
  - Request routing & validation
  - Rate limiting & security headers
  - Swagger API documentation

- **Data Service**: Python + FastAPI
  - PDF parsing (pdfplumber)
  - AI categorization (Google Gemini)
  - Analytics engine (Pandas, NumPy)
  - Chart generation (Matplotlib)

### Frontend
- **React 18** with Vite
- **Tailwind CSS** for styling
- **Recharts** for visualizations
- **Zustand** for state management
- **React Router** for navigation

### Infrastructure
- **PostgreSQL** database
- **Docker** & Docker Compose
- **GitHub Actions** CI/CD (coming soon)

## Features

1. **Bank Statement PDF Parsing** - Upload Chase PDFs for automatic transaction extraction
2. **AI Auto-Categorization** - Gemini AI categorizes transactions with high accuracy
3. **Spending Dashboard** - Interactive charts and spending breakdowns
4. **Budget Goals & Alerts** - Set limits and get notified when approaching them
5. **AI Insights & Anomalies** - Personalized financial insights and unusual transaction detection
6. **Natural Language Query** - Ask questions about your finances in plain English

## Project Structure

```
pennywise-2.0/
├── docker-compose.yml          # Container orchestration
├── .env.example                # Environment template
│
├── gateway/                    # Node.js API Gateway
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js           # Express app entry
│       ├── routes/            # API endpoints
│       │   ├── auth.js        # Login/register
│       │   ├── users.js       # User management
│       │   ├── transactions.js # CRUD operations
│       │   ├── budgets.js     # Budget management
│       │   └── dataServiceProxy.js # Python service proxy
│       ├── middleware/
│       │   ├── auth.js        # JWT verification
│       │   └── errorHandler.js
│       └── services/
│           └── database.js    # PostgreSQL connection
│
├── data-service/              # Python Data Processing
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py            # FastAPI entry
│       ├── config.py          # Settings
│       ├── routers/           # API routes
│       │   ├── pdf_parser.py
│       │   ├── categorization.py
│       │   ├── analytics.py
│       │   ├── insights.py
│       │   └── nlp_query.py
│       ├── services/
│       │   ├── pdf_parser.py  # Chase PDF extraction
│       │   ├── gemini_service.py # AI integration
│       │   ├── analytics_service.py # Pandas analytics
│       │   └── database.py
│       └── models/
│           └── schemas.py     # Pydantic models
│
├── frontend/                  # React Application
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx            # Router setup
│       ├── main.jsx           # Entry point
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Transactions.jsx
│       │   ├── Upload.jsx
│       │   ├── Budgets.jsx
│       │   ├── Insights.jsx
│       │   └── Ask.jsx
│       ├── components/
│       │   └── Layout.jsx
│       ├── store/
│       │   ├── authStore.js   # Zustand auth
│       │   └── transactionStore.js
│       └── services/
│           └── api.js         # Axios client
│
└── docker/
    └── init.sql               # Database schema
```


## Project Overview
PennyWise.wtf is a full-stack application for personal finance management, featuring analytics, categorization, insights, and more.

## Prerequisites
- Docker & Docker Compose
- Node.js (for frontend/gateway dev)
- Python 3.8+ (for data-service dev)

## Quick Start (Recommended)

### 1. Clone the repository
```
git clone <your-repo-url>
cd PennyWise
```

### 2. Start with Docker Compose
```
docker-compose up --build
```

This will build and start all services (backend, frontend, gateway).

---

## Manual Setup

### Backend (data-service)
1. Navigate to the backend folder:
  ```
  cd data-service
  ```
2. Create and activate a virtual environment:
  ```
  python3 -m venv venv
  source venv/bin/activate
  ```
3. Install dependencies:
  ```
  pip install -r requirements.txt
  ```
4. Run the backend:
  ```
  uvicorn app.main:app --reload
  ```

### Frontend
1. Navigate to the frontend folder:
  ```
  cd frontend
  ```
2. Install dependencies:
  ```
  npm install
  ```
3. Start the frontend:
  ```
  npm run dev
  ```

### Gateway
1. Navigate to the gateway folder:
  ```
  cd gateway
  ```
2. Install dependencies:
  ```
  npm install
  ```
3. Start the gateway:
  ```
  npm start
  ```

---

## Notes
- Do not commit .env files or venv folders.
- Update the .env files as needed for your environment.
- For production, configure environment variables and secrets securely.

## License
MIT
| Variable | Description | Default |
|----------|-------------|---------|
| POSTGRES_USER | Database user | pennywise |
| POSTGRES_PASSWORD | Database password | pennywise_secret |
| POSTGRES_DB | Database name | pennywise |
| JWT_SECRET | JWT signing key | (required) |
| GEMINI_API_KEY | Google Gemini API key | (required for AI) |
| NODE_ENV | Environment | development |

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Helmet security headers
- Rate limiting (100 req/15min)
- Input validation
- SQL injection prevention
- Non-root Docker containers
- Health checks

## DevSecOps Roadmap

- [ ] GitHub Actions CI/CD pipeline
- [ ] Security scanning (Trivy, Bandit)
- [ ] Test automation (Jest, Pytest)
- [ ] Infrastructure as Code
- [ ] Kubernetes deployment
- [ ] Monitoring & alerting

## License

MIT

## Author

Built as a capstone project demonstrating full-stack development with AI integration and DevSecOps practices.
