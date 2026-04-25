# Ridesk Server

A Node.js/Express backend server for the Ridesk watersports school management platform, built with TypeScript, Supabase, and comprehensive API documentation

## 🚀 Features

- **Authentication System**: JWT-based auth with role-based access control
- **Multi-tenant Architecture**: Support for multiple schools
- **RESTful API**: Well-documented endpoints with Swagger/OpenAPI
- **Database Integration**: PostgreSQL with Supabase
- **Security**: Row Level Security (RLS) policies.
- **Type Safety**: Full TypeScript implementation

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL (Supabase)
- **Authentication**: JWT + Supabase Auth
- **Documentation**: Swagger/OpenAPI
- **Validation**: Joi
- **Security**: Helmet, CORS, Rate Limiting

## 📋 Prerequisites

- Node.js 18 or higher
- npm or yarn
- Supabase account and project
- Vercel account (for deployment)

## 🔧 Local Development Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd ridesk-server
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Database Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### 4. Start Development Server

```bash
# Build TypeScript
npm run build

# Start development server
npm run dev
```

The server will start on `http://localhost:3001`

## 📚 API Documentation

Once the server is running, visit:

- **Swagger UI**: `http://localhost:3001/api/docs`
- **API Endpoints**: `http://localhost:3001/api`

## 🚀 Vercel Deployment

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Configure Environment Variables

In your Vercel dashboard, go to your project settings and add these environment variables:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Deploy

```bash
# Deploy to Vercel
vercel

# For production deployment
vercel --prod
```

### 5. Configure Vercel Settings

Create a `vercel.json` file in the root directory:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

## 🔒 Security Considerations

- **Environment Variables**: Never commit `.env` files
- **JWT Secret**: Use a strong, random secret key
- **CORS**: Configure appropriate origins for production
- **Rate Limiting**: Adjust limits based on your needs
- **RLS Policies**: Review and test all database policies

## 📝 Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues

# Database
npm run db:push      # Push migrations to Supabase
npm run db:reset     # Reset database and apply migrations
```

## 🏗️ Project Structure

```
ridesk-server/
├── src/
│   ├── config/          # Configuration files
│   ├── database/        # Database client and types
│   ├── middleware/      # Express middleware
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic
│   └── types/           # TypeScript type definitions
├── supabase/
│   └── migrations/      # Database migration files
├── dist/                # Compiled JavaScript (generated)
├── .env                 # Environment variables (not committed)
├── vercel.json          # Vercel deployment configuration
└── package.json
```

## 🔗 API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user profile

### Schools

- `GET /api/schools` - List all schools
- `POST /api/schools` - Create new school
- `GET /api/schools/:id` - Get school by ID
- `PUT /api/schools/:id` - Update school
- `DELETE /api/schools/:id` - Delete school

### Health Check

- `GET /api/health` - Server health status
- `GET /api/health/database` - Database connection status

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**

   - Check Supabase credentials
   - Verify network connectivity
   - Ensure migrations are applied

2. **JWT Token Issues**

   - Verify JWT_SECRET is set
   - Check token expiration settings
   - Ensure proper token format

3. **CORS Errors**

   - Update CORS_ORIGIN environment variable
   - Check frontend URL configuration

4. **RLS Policy Violations**
   - Review database policies
   - Check user permissions
   - Verify service role configuration

## 📞 Support

For issues and questions:

- Check the API documentation at `/api/docs`
- Review the migration files in `supabase/migrations/`
- Check server logs for detailed error messages

## 📄 License

This project is proprietary software for Ridesk watersports management platform.
