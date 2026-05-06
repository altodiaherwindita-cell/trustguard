# TrustGuard AI - Third-Party Risk Management Platform

A comprehensive TPRM platform for managing vendor security assessments with AI-powered risk analysis.

## 🚀 Features

- **Vendor Management**: Create, track, and manage vendor relationships
- **Security Assessments**: Data-driven questionnaires for security evaluation
- **AI-Powered Analysis**: Automated risk scoring and recommendations
- **Role-Based Access Control**: Admin, TPRM Analyst, and Vendor roles
- **Dashboard & Reporting**: Real-time risk metrics and visualizations
- **Multi-Tenant Support**: Isolated data per organization

## 🏗️ Architecture

### Frontend
- React 18 + TypeScript
- Vite for build tooling
- Tailwind CSS + shadcn/ui for styling
- React Query for data fetching
- React Router for navigation

### Backend
- Node.js + Express
- PostgreSQL database
- JWT authentication
- RESTful API

### Infrastructure
- Docker & Docker Compose
- Nginx for production serving
- Health checks and monitoring ready

## 📋 Prerequisites

- Node.js 20+ 
- Docker & Docker Compose (for containerized deployment)
- PostgreSQL 15+ (for local development without Docker)
- npm or bun package manager

## 🛠️ Local Development Setup

### Option 1: Using Docker Compose (Recommended)

1. **Clone the repository**
```bash
git clone <repository-url>
cd trustguard-ai
```

2. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your production values
```

3. **Start all services**
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Backend API on port 3000
- Frontend web app on port 80

4. **Access the application**
- Frontend: http://localhost
- API: http://localhost:3000
- API Health: http://localhost:3000/health

Default admin credentials:
- Email: admin@trustguard.ai
- Password: admin123 (**Change immediately!**)

### Option 2: Local Development

1. **Install dependencies**
```bash
# Frontend
npm install

# Backend
cd server
npm install
```

2. **Setup database**
```bash
# Create database
createdb trustguard

# Run initialization script
psql -d trustguard -f init.sql
```

3. **Configure environment**
```bash
cp .env.example .env
# Update DB_HOST=localhost in .env
```

4. **Start backend**
```bash
cd server
npm run dev
```

5. **Start frontend** (in another terminal)
```bash
npm run dev
```

## 🐳 Docker Commands

```bash
# Build all images
docker-compose build

# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart api

# Rebuild and restart
docker-compose up -d --build
```

## 📁 Project Structure

```
trustguard-ai/
├── src/                    # Frontend React code
│   ├── components/        # UI components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom hooks
│   ├── pages/             # Page components
│   ├── lib/               # Utilities
│   └── types/             # TypeScript types
├── server/                 # Backend API
│   ├── routes/            # API route handlers
│   ├── middleware/        # Express middleware
│   └── index.js           # API entry point
├── supabase/              # Legacy Supabase migrations (reference)
├── docker-compose.yml     # Docker orchestration
├── Dockerfile             # Frontend Docker image
├── Dockerfile.api         # Backend Docker image
├── init.sql               # Database schema
└── nginx.conf             # Nginx configuration
```

## 🔐 Security Considerations

1. **Change default credentials** immediately after deployment
2. **Use strong JWT_SECRET** in production (generate with `openssl rand -hex 32`)
3. **Enable HTTPS** in production
4. **Regular security updates** for dependencies
5. **Database backups** should be configured
6. **Environment variables** should never be committed

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Users (Admin only)
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `PATCH /api/users/:id/role` - Update user role
- `PATCH /api/users/:id/status` - Activate/deactivate user

### Vendors
- `GET /api/vendors` - List vendors (TPRM)
- `GET /api/vendors/my-vendors` - List my vendors
- `GET /api/vendors/:id` - Get vendor details
- `POST /api/vendors` - Create vendor (TPRM)
- `PATCH /api/vendors/:id` - Update vendor
- `DELETE /api/vendors/:id` - Delete vendor (TPRM)

### Assessments
- `GET /api/assessments` - List assessments (TPRM)
- `GET /api/assessments/my-assessments` - List my assessments
- `GET /api/assessments/:id/details` - Get assessment with responses
- `POST /api/assessments` - Create assessment (TPRM)
- `POST /api/assessments/:id/responses` - Submit response
- `POST /api/assessments/:id/submit` - Submit for review
- `POST /api/assessments/:id/review` - Review assessment (TPRM)

## 🧪 Testing

```bash
# Frontend tests
npm run test

# Backend manual testing
curl http://localhost:3000/health
```

## 🔄 Migration from Supabase

This project has been migrated from Supabase to a self-hosted PostgreSQL setup. Key changes:

1. **Authentication**: Moved from Supabase Auth to JWT-based auth
2. **Database**: Schema adapted from Supabase migrations to standalone PostgreSQL
3. **API**: New Express backend replaces direct Supabase client calls
4. **Frontend**: Updated to use REST API instead of Supabase client

## 📝 Environment Variables

See `.env.example` for all available options:

| Variable | Description | Default |
|----------|-------------|---------|
| DB_USER | Database username | trustguard |
| DB_PASSWORD | Database password | changeme_in_production |
| DB_NAME | Database name | trustguard |
| DB_PORT | Database port | 5432 |
| JWT_SECRET | JWT signing secret | change_this_in_production |
| API_PORT | API server port | 3000 |
| WEB_PORT | Web server port | 80 |

## 🚨 Production Deployment

1. **Update .env** with secure values
2. **Build images**: `docker-compose build`
3. **Deploy** to your cloud provider
4. **Configure SSL/TLS** termination
5. **Set up monitoring** and alerts
6. **Configure backups** for PostgreSQL volume

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
