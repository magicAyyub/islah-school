# Islah School Management System

Backend for Islamic school management: enrollments, classes, payments, guardian relationships.

ER Diagram - [ER Diagram](./public/ERD.png)
<br>
French one (MCD) - [MCD](./public/MCD.png)


## Quick Start

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker-compose up -d

# Setup database
npm run db:push
npm run db:seed

# Verify
npm run db:studio  # Open database GUI
npm test           # Run tests
npm run cli        # Launch CLI
```

## Requirements

- Node.js 18+
- Docker Desktop

## Configuration

Create `.env`:

```env
DATABASE_URL=postgresql://admin:admin@localhost:5432/islah_db
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run cli` | Launch interactive CLI |
| `npm run db:push` | Apply schema to database |
| `npm run db:studio` | Open database GUI |
| `npm run db:seed` | Seed levels and slots |
| `npm test` | Run test suite |
| `npm run test:ui` | Open test UI |

## Database

### Tables

| Table | Purpose |
|-------|---------|
| `guardians` | Parent/tutor contacts |
| `students` | Student records with status |
| `family_links` | Guardian-student relationships |
| `levels` | Academic levels |
| `slots` | Time slots |
| `classes` | Groups with capacity |
| `enrollments` | Student enrollments |
| `payments` | Financial transactions |

### Connection (Local)

| Parameter | Value |
|-----------|-------|
| Host | localhost |
| Port | 5432 |
| Database | islah_db |
| User | admin |
| Password | admin |

## Services

| Service | File | Functions |
|---------|------|-----------|
| Classes | `class.service.ts` | Create, list, check capacity, find available |
| Guardians | `guardian.service.ts` | Create guardian/student, link, check duplicates |
| Enrollments | `enrollment.service.ts` | Create, validate, cancel, get details |
| Payments | `payment.service.ts` | Create, mark bounced, calculate balance |

## CLI Operations

```bash
npm run cli
```

### Class Management
- Create class with capacity
- List classes with availability
- Check capacity
- Create parallel groups

### Student & Guardian
- Register guardian
- Register student
- Link guardian to student
- Check duplicates
- View family tree

### Enrollment
- Create enrollment
- Validate enrollment
- Cancel enrollment
- View details

### Payment
- Record payment
- Mark as bounced
- View balance
- List payments

## Business Rules

### Enrollment Workflow

1. Created with `PENDING` status
2. Requires available capacity in class
3. Student must be `ACTIVE` (not `BLOCKED`)
4. Validated after `REGISTRATION` payment completed
5. One enrollment per student per academic year

### Payment Processing

| Status | Effect on Balance |
|--------|-------------------|
| `COMPLETED` | Reduces debt |
| `PENDING` | Ignored |
| `BOUNCED` | Ignored, blocks student |

### Bounced Check Automation

When payment marked as `BOUNCED`:
1. Student folder set to `BLOCKED`
2. Student cannot enroll
3. Administrator receives alert

### Capacity Management

- Enrollment rejected when `VALIDATED enrollments >= capacity_max`
- Create Group B when Group A full
- Each group maintains independent count

## Testing

```bash
npm test
```

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| Class Service | 12 | Capacity, parallel groups, isolation |
| Enrollment Service | 10 | Validation, blocking, duplicates |
| Payment Service | 11 | Balance, bounced checks, periods |
| Guardian Service | 9 | Linking, duplicates, family tree |

## Service Response Format

```typescript
{
  success: boolean;
  message: string;
  data?: T;
}
```

## Usage Examples

### Create Enrollment

```typescript
const result = await createEnrollment({
  studentId: "uuid",
  classId: "uuid",
  academicYear: 2025,
  type: "NEW"
});

if (!result.success) {
  console.error(result.message); // Class full, student blocked, or duplicate
}
```

### Check Balance

```typescript
const balance = await getEnrollmentBalance(enrollmentId, 2000);
console.log(`Paid: ${balance.totalPaid} MAD`);
console.log(`Balance: ${balance.balance} MAD`);
```

### Mark Bounced Check

```typescript
const result = await markPaymentAsBounced(paymentId);
// Student automatically blocked
```

## Schema Updates

1. Edit `src/db/schema.ts`
2. Run `npm run db:push`
3. Update affected services
4. Update tests

## Production

Use Neon or Supabase for PostgreSQL. Update `DATABASE_URL` in `.env`.
