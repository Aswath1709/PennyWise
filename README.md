# PennyWise 2.0 - AI-Powered Personal Finance Tracker

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

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)
- Gemini API key (get one at https://makersuite.google.com/app/apikey)

### Quick Start with Docker

1. Clone the repository:
```bash
git clone https://github.com/yourusername/pennywise-2.0.git
cd pennywise-2.0
```

2. Create environment file:
```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

3. Start all services:
```bash
docker-compose up --build
```

4. Access the application:
- Frontend: http://localhost:5173
- API Gateway: http://localhost:3000
- API Docs: http://localhost:3000/api/docs
- Data Service: http://localhost:8000

### Local Development

**Gateway (Node.js):**
```bash
cd gateway
npm install
npm run dev
```

**Data Service (Python):**
```bash
cd data-service
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend (React):**
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Get JWT token
- `GET /api/auth/me` - Get current user

### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction
- `POST /api/transactions/bulk` - Bulk create
- `PUT /api/transactions/:id` - Update
- `DELETE /api/transactions/:id` - Delete

### Budgets
- `GET /api/budgets` - List with progress
- `POST /api/budgets` - Create budget
- `GET /api/budgets/alerts/active` - Get alerts

### Data Service (via proxy)
- `POST /api/data/pdf/parse-and-categorize` - Parse PDF
- `POST /api/data/analytics/summary` - Get analytics
- `POST /api/data/insights/generate` - AI insights
- `POST /api/data/query` - Natural language query

## Environment Variables

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
