# Hope for Haiti Role-Based Authentication System

## Overview

The Millennium-Project now includes a production-grade authentication system with:
- **NextAuth.js v5** for session management
- **JWT-based stateless sessions** for scalability
- **Invite-only registration** (no self-signup)
- **Role-based access control** with 7 permission flags
- **User status management** (pending, active, deactivated)
- **PostgreSQL** for data persistence

## Architecture

### User Model
```
- id: Auto-incrementing primary key
- email: Unique identifier
- passwordHash: Bcrypt-hashed password
- type: STAFF | PARTNER (enum)
- enabled: Account activation status
- pending: Approval status (before enabled=true)
- isSuper: Admin flag (read-only, can't be self-set)
- Permission flags: userRead, userWrite, orderRead, orderWrite, reportRead, reportWrite
```

### Permission System
- **isSuper**: Grants all permissions (bypass all checks)
- **userRead/Write**: User management access
- **orderRead/Write**: Order management access
- **reportRead/Write**: Report management access

### Invite System
- Invites expire after 24 hours
- One-time use tokens
- Pre-configure user type and initial permissions
- Email address required for invite

## Setup

### 1. Database Setup

Create a PostgreSQL database:
```bash
createdb millennium
```

Update `.env` with your database URL:
```
DATABASE_URL="postgresql://username:password@localhost:5432/millennium"
```

### 2. Environment Configuration

Generate AUTH_SECRET:
```bash
openssl rand -base64 32
```

Update `.env`:
```
AUTH_SECRET="<your-generated-secret>"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="development"
```

### 3. Database Migration

Run migrations:
```bash
npm run db:migrate
```

### 4. Seed Test Data

Populate with test users:
```bash
npm run db:seed
```

Test credentials:
- **Admin**: admin@test.com / password123
- **Staff**: staff@test.com / password123
- **Partner**: partner@test.com / password123
- **Pending**: pending@test.com / password123

## Routes

### Public Routes
- `/signIn` - Login page
- `/register?token=<invite-token>` - Invite-based registration
- `/pending` - Pending activation status page
- `/deactivated` - Deactivated account page

### Protected Routes
- `/` - Dashboard (requires active session)
- `/api/users` - User management (authenticated)
- `/api/invites` - Invite management (authenticated)

## Development

Start dev server:
```bash
npm run dev
```

View database UI:
```bash
npm run db:view
```

## Building

Production build:
```bash
npm run build
npm run start
```

## Invite Flow Example

1. Admin creates invite via API:
   ```bash
   curl -X POST http://localhost:3000/api/invites \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "email=newuser@example.com&userType=STAFF"
   ```

2. System generates token and returns it

3. User visits `/register?token=<token>`

4. User enters password and name

5. User account created with `pending=true, enabled=false`

6. Admin approves user (sets `enabled=true, pending=false`)

7. User can now login

## Permission Checking

Use `UserService.checkPermission()`:
```typescript
const canWrite = await UserService.checkPermission(userId, 'orderWrite');
```

## Type Extensions

Session types are extended in `src/types/next-auth.d.ts`:
```typescript
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      type: "staff" | "partner";
      enabled: boolean;
      pending: boolean;
    };
  }
}
```

## Security Considerations

- ✅ Passwords hashed with bcryptjs (12 salt rounds)
- ✅ JWT tokens signed with AUTH_SECRET
- ✅ Middleware validates session on protected routes
- ✅ isSuper flag is read-only (can't be set via API)
- ✅ Invites expire after 24 hours
- ✅ Status validation prevents unauthorized access

## Troubleshooting

### Database connection error
Check DATABASE_URL in .env and ensure PostgreSQL is running:
```bash
pg_isready -h localhost -p 5432
```

### AUTH_SECRET not set
Generate and add to .env:
```bash
openssl rand -base64 32
```

### Build errors
Ensure dependencies are installed:
```bash
npm install --legacy-peer-deps
npm run db:generate
```

## Next Steps

1. Set up email sending for invites
2. Implement admin dashboard for user management
3. Add password reset flow
4. Configure OAuth providers (Google, GitHub, etc.)
5. Set up email notifications
6. Deploy to production (Vercel, AWS, etc.)

## Files Structure

```
src/
├── auth/
│   ├── index.ts                    # NextAuth configuration
│   └── auth.config.ts              # Base auth config (JWT, callbacks)
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/     # NextAuth API route
│   │   ├── users/                  # User CRUD endpoint
│   │   └── invites/                # Invite management
│   ├── signIn/page.tsx             # Login page
│   ├── register/page.tsx           # Invite-based registration
│   ├── pending/page.tsx            # Pending activation status
│   ├── deactivated/page.tsx        # Deactivated account status
│   └── page.tsx                    # Dashboard
├── services/
│   └── userService.ts              # Business logic for users/invites
├── lib/
│   └── db.ts                       # Prisma client singleton
├── middleware.ts                   # Route protection
└── types/
    └── next-auth.d.ts              # Session type extensions
prisma/
├── schema.prisma                   # Data models
└── migrations/                     # Database versions
```
