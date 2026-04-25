# Ridesk Server API Documentation

## Overview

The Ridesk Server provides a comprehensive REST API for managing water sports schools, instructors, students, lessons, and more. This API is built with Node.js, Express, TypeScript, and uses Supabase as the backend database.

## Base URL

- **Development**: `http://localhost:5001`
- **Production**: `https://api.ridesk.com`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Interactive Documentation

Visit the interactive Swagger UI documentation at:

- **Development**: `http://localhost:5001/api/docs`
- **Production**: `https://api.ridesk.com/api/docs`

## API Endpoints

### Authentication Endpoints

| Method | Endpoint                            | Description               | Access                              |
| ------ | ----------------------------------- | ------------------------- | ----------------------------------- |
| POST   | `/api/auth/init-super-admin`        | Initialize super admin    | Public                              |
| GET    | `/api/auth/super-admin-credentials` | Get super admin creds     | Public                              |
| POST   | `/api/auth/register`                | Register a new user       | Private (SUPER_ADMIN, SCHOOL_ADMIN) |
| POST   | `/api/auth/login`                   | Login user                | Public                              |
| POST   | `/api/auth/refresh`                 | Refresh access token      | Public                              |
| GET    | `/api/auth/me`                      | Get current user info     | Private                             |
| GET    | `/api/auth/users`                   | Get all users (paginated) | Private (SUPER_ADMIN)               |
| PUT    | `/api/auth/users/:userId`           | Update user information   | Private (SUPER_ADMIN)               |
| PUT    | `/api/auth/password`                | Change password           | Private                             |
| PUT    | `/api/auth/school`                  | Update user's school      | Private                             |
| POST   | `/api/auth/logout`                  | Logout user               | Public                              |
| DELETE | `/api/auth/deactivate/:userId`      | Deactivate user           | Private (SUPER_ADMIN)               |

### School Management Endpoints

| Method | Endpoint                    | Description                 | Access                        |
| ------ | --------------------------- | --------------------------- | ----------------------------- |
| POST   | `/api/schools`              | Create new school           | Private (SUPER_ADMIN)         |
| GET    | `/api/schools`              | Get all schools (paginated) | Private (SUPER_ADMIN)         |
| GET    | `/api/schools/search`       | Search schools              | Private (SUPER_ADMIN)         |
| GET    | `/api/schools/:id`          | Get school by ID            | Private (School members)      |
| GET    | `/api/schools/user/:userId` | Get school by user ID       | Private (User or SUPER_ADMIN) |
| GET    | `/api/schools/slug/:slug`   | Get school by slug          | Public                        |
| PUT    | `/api/schools/:id`          | Update school               | Private (School admins)       |
| DELETE | `/api/schools/:id`          | Deactivate school           | Private (SUPER_ADMIN)         |

### Student Management Endpoints

| Method | Endpoint                     | Description                      | Access                 |
| ------ | ---------------------------- | -------------------------------- | ---------------------- |
| POST   | `/api/students`              | Create new student               | Private (SUPER_ADMIN)  |
| POST   | `/api/students/school-admin` | Create student (with invitation) | Private (SCHOOL_ADMIN) |
| GET    | `/api/students`              | Get all students (paginated)     | Private (SCHOOL_ADMIN) |
| GET    | `/api/students/search`       | Search students                  | Private (SCHOOL_ADMIN) |
| GET    | `/api/students/:id`          | Get student by ID                | Private (SCHOOL_ADMIN) |
| PUT    | `/api/students/:id`          | Update student                   | Private (SCHOOL_ADMIN) |
| DELETE | `/api/students/:id`          | Delete student (hard delete)     | Private (SCHOOL_ADMIN) |

### Instructor Management Endpoints

| Method | Endpoint                        | Description                         | Access                 |
| ------ | ------------------------------- | ----------------------------------- | ---------------------- |
| POST   | `/api/instructors`              | Create new instructor               | Private (SUPER_ADMIN)  |
| POST   | `/api/instructors/school-admin` | Create instructor (with invitation) | Private (SCHOOL_ADMIN) |
| GET    | `/api/instructors`              | Get all instructors (paginated)     | Private (SCHOOL_ADMIN) |
| GET    | `/api/instructors/search`       | Search instructors                  | Private (SCHOOL_ADMIN) |
| GET    | `/api/instructors/:id`          | Get instructor by ID                | Private (SCHOOL_ADMIN) |
| PUT    | `/api/instructors/:id`          | Update instructor                   | Private (SCHOOL_ADMIN) |
| DELETE | `/api/instructors/:id`          | Deactivate instructor               | Private (SCHOOL_ADMIN) |

### Instructor-School Management Endpoints

| Method | Endpoint                                 | Description                   | Access                |
| ------ | ---------------------------------------- | ----------------------------- | --------------------- |
| POST   | `/api/instructor-schools/assign`         | Assign instructor to school   | Private (SUPER_ADMIN) |
| DELETE | `/api/instructor-schools/remove`         | Remove instructor from school | Private (SUPER_ADMIN) |
| GET    | `/api/instructor-schools/instructor/:id` | Get schools for instructor    | Private (SUPER_ADMIN) |
| GET    | `/api/instructor-schools/school/:id`     | Get instructors for school    | Private (SUPER_ADMIN) |
| PUT    | `/api/instructor-schools/:assignmentId`  | Update instructor assignment  | Private (SUPER_ADMIN) |

### User Invitation Endpoints

| Method | Endpoint                           | Description               | Access                 |
| ------ | ---------------------------------- | ------------------------- | ---------------------- |
| POST   | `/api/invitations/accept`          | Accept invitation         | Public                 |
| GET    | `/api/invitations/validate/:token` | Validate invitation token | Public                 |
| POST   | `/api/invitations/test-email`      | Test email configuration  | Private (SCHOOL_ADMIN) |

### Health Check Endpoints

| Method | Endpoint           | Description           | Access |
| ------ | ------------------ | --------------------- | ------ |
| GET    | `/health`          | Basic health check    | Public |
| GET    | `/health/database` | Database health check | Public |

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "details": {
    // Additional error details (optional)
  }
}
```

### Validation Error Response

```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "email": ["Email is required"],
    "password": ["Password must be at least 6 characters long"]
  }
}
```

## Pagination

Paginated endpoints support the following query parameters:

- `page` (integer, min: 1, default: 1) - Page number
- `limit` (integer, min: 1, max: 100, default: 10) - Items per page

Response includes pagination metadata:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## User Roles

The API supports four user roles with different permission levels:

### SUPER_ADMIN

- Full access to all resources
- Can create and manage schools
- Can manage all users across all schools
- Can access system-wide analytics

### SCHOOL_ADMIN

- Full access to their school's resources
- Can manage instructors, students, and lessons within their school
- Can view school analytics and reports
- Cannot access other schools' data

### INSTRUCTOR

- Can view and manage their own lessons
- Can view students assigned to their lessons
- Can update their availability
- Can view their compensation data

### USER

- Basic access to view their own profile
- Limited access to school information
- Can view their own lesson history

## Rate Limiting

API requests are limited to:

- **100 requests per 15-minute window** per IP address
- Rate limit headers are included in responses:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Time when the rate limit resets

## Error Codes

| Code | Description                             |
| ---- | --------------------------------------- |
| 400  | Bad Request - Invalid input data        |
| 401  | Unauthorized - Authentication required  |
| 403  | Forbidden - Insufficient permissions    |
| 404  | Not Found - Resource not found          |
| 409  | Conflict - Resource already exists      |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Internal Server Error - Server error    |

## Data Models

### User

```typescript
{
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'INSTRUCTOR' | 'USER';
  schoolId?: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### School

```typescript
{
  id: string;
  name: string;
  slug: string;
  logo?: string;
  email?: string;
  phone?: string;
  address?: string;
  spotName?: string;
  windguruUrl?: string;
  disciplines: ('kite' | 'surf' | 'wing')[];
  openHoursStart?: string;
  openHoursEnd?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## Getting Started

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Environment Setup**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Development Server**

   ```bash
   npm run dev
   ```

4. **Access API Documentation**
   - Open `http://localhost:5000/api/docs` in your browser
   - Explore the interactive Swagger UI

## Testing the API

### Using cURL

1. **Initialize Super Admin**

   ```bash
   curl -X POST http://localhost:5001/api/auth/init-super-admin
   ```

2. **Login as Super Admin**

   ```bash
   curl -X POST http://localhost:5001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "superadmin@ridesk.com",
       "password": "SuperAdmin123!"
     }'
   ```

3. **Register a new user (with Super Admin token)**

   ```bash
   curl -X POST http://localhost:5001/api/auth/register \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <your-jwt-token>" \
     -d '{
       "email": "admin@school.com",
       "password": "password123",
       "firstName": "John",
       "lastName": "Doe",
       "role": "SCHOOL_ADMIN"
     }'
   ```

4. **Update user information**

   ```bash
   curl -X PUT http://localhost:5001/api/auth/users/{userId} \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <your-jwt-token>" \
     -d '{
       "firstName": "John",
       "lastName": "Smith",
       "email": "john.smith@example.com",
       "schoolId": "school-uuid"
     }'
   ```

5. **Get user profile (with token)**
   ```bash
   curl -X GET http://localhost:5001/api/auth/me \
     -H "Authorization: Bearer <your-jwt-token>"
   ```

### Student Management Examples

1. **Create a new student**

   ```bash
   curl -X POST http://localhost:5001/api/students \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <your-jwt-token>" \
     -d '{
       "firstName": "Alice",
       "lastName": "Johnson",
       "email": "alice.johnson@example.com",
       "phone": "+1234567890",
       "skillLevel": "beginner",
       "preferredDisciplines": ["kite", "surf"]
     }'
   ```

2. **Get all students (paginated)**

   ```bash
   curl -X GET "http://localhost:5001/api/students?page=1&limit=10&search=alice" \
     -H "Authorization: Bearer <your-jwt-token>"
   ```

3. **Update student information**
   ```bash
   curl -X PUT http://localhost:5001/api/students/{studentId} \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <your-jwt-token>" \
     -d '{
       "firstName": "Alice",
       "lastName": "Smith",
       "skillLevel": "intermediate"
     }'
   ```

### Instructor Management Examples

1. **Create a new instructor**

   ```bash
   curl -X POST http://localhost:5001/api/instructors \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <your-jwt-token>" \
     -d '{
       "firstName": "Marco",
       "lastName": "Rossi",
       "email": "marco.rossi@example.com",
       "specialties": ["kite", "surf"],
       "languages": ["English", "Italian"],
       "isPrimary": true,
       "hourlyRate": 50.0
     }'
   ```

2. **Get all instructors (paginated)**

   ```bash
   curl -X GET "http://localhost:5001/api/instructors?page=1&limit=10&search=marco" \
     -H "Authorization: Bearer <your-jwt-token>"
   ```

3. **Update instructor information**
   ```bash
   curl -X PUT http://localhost:5001/api/instructors/{instructorId} \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <your-jwt-token>" \
     -d '{
       "specialties": ["kite", "surf", "wing"],
       "hourlyRate": 60.0,
       "commissionRate": 20.0
     }'
   ```

### Using Swagger UI

1. Open `http://localhost:5001/api/docs`
2. Click "Authorize" button
3. Enter your JWT token
4. Test endpoints directly from the interface

## Database Schema

The API uses Supabase (PostgreSQL) with the following main tables:

- `users` - User accounts and authentication
- `schools` - School information and settings
- `instructors` - Instructor profiles and availability
- `students` - Student profiles and information
- `lessons` - Lesson bookings and scheduling
- `products` - School products and services
- `lesson_participants` - Many-to-many relationship between lessons and students
- `instructor_rates` - Instructor compensation rates
- `student_notes` - Student progress and notes
- `school_calendar` - School events and closures

## Security Features

- **JWT Authentication** with configurable expiration
- **Password Hashing** using bcrypt
- **Input Validation** with Joi schemas
- **SQL Injection Protection** through parameterized queries
- **XSS Protection** with helmet middleware
- **Rate Limiting** to prevent abuse
- **CORS Configuration** for cross-origin requests
- **Row Level Security** in database for multi-tenancy

## Support

For API support and questions:

- **Email**: support@ridesk.com
- **Documentation**: https://docs.ridesk.com
- **GitHub**: https://github.com/ridesk/server

## License

This API is licensed under the MIT License. See the LICENSE file for details.
