# 🗄️ Database Seeding Scripts

This directory contains scripts to seed the database with test data for the Ridesk Calendar system.

## 🚀 Quick Start

### Prerequisites
1. Make sure your database is set up and migrations are applied
2. Ensure your `.env` file has the correct database connection settings
3. Make sure the server can connect to the database

### Run the Seeding Script

```bash
# From the ridesk-server directory
npm run seed
```

This will create:
- ✅ 1 test school
- ✅ 3 test instructors with availability
- ✅ 3 test students
- ✅ 4 test products
- ✅ Multiple availability slots (7 days)
- ✅ 3 sample lessons
- ✅ Lesson and payment statuses

## 📋 What Gets Created

### School
- **Name**: Test Surf School
- **Location**: Test Beach, California
- **Disciplines**: Kitesurf, Surf, Wingfoil
- **Hours**: 9 AM - 6 PM

### Instructors
1. **Alex Smith** - Kitesurf specialist (Primary)
2. **Maria Garcia** - Surf specialist
3. **John Doe** - Wingfoil specialist

### Students
1. **Emma Wilson** - Beginner (Kitesurf, Surf)
2. **Tom Brown** - Intermediate (Surf, Wingfoil)
3. **Sarah Johnson** - Advanced (Kitesurf, Wingfoil)

### Products
1. **Kitesurf Lesson** - 60 min, €80
2. **Surf Lesson** - 90 min, €70
3. **Wingfoil Lesson** - 120 min, €100
4. **Advanced Kitesurf** - 120 min, €150

### Availability
- Each instructor has availability for 7 days
- Morning slots: 9 AM - 12 PM
- Afternoon slots: 2 PM - 6 PM

### Sample Lessons
- **Today**: Kitesurf lesson (Alex + Emma), Surf lesson (Maria + Tom)
- **Tomorrow**: Wingfoil lesson (John + Sarah)

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Error**
   ```
   Error: Database connection failed
   ```
   - Check your `.env` file
   - Ensure database is running
   - Verify connection string

2. **Permission Error**
   ```
   Error: Permission denied
   ```
   - Check database permissions
   - Ensure RLS policies allow admin operations

3. **Duplicate Data Error**
   ```
   Error: Duplicate key value
   ```
   - Data already exists
   - Run with `--reset` flag to clear first

### Reset and Reseed

If you need to clear existing data and start fresh:

```bash
# This will clear all test data and reseed
npm run seed:reset
```

**⚠️ Warning**: This will delete all test data. Use with caution in production.

## 🧪 Testing After Seeding

1. **Start the server**:
   ```bash
   npm run dev
   ```

2. **Start the client**:
   ```bash
   cd ../ridesk-client
   npm run dev
   ```

3. **Test the calendar**:
   - Go to `http://localhost:3000/calendar`
   - Verify instructors are visible
   - Check availability slots
   - Try creating a lesson
   - Test filtering options

## 📊 Verification

After running the seed script, you can verify the data was created by checking these tables:

```sql
-- Check schools
SELECT * FROM schools WHERE name = 'Test Surf School';

-- Check instructors
SELECT first_name, last_name, specialties FROM instructors;

-- Check students
SELECT first_name, last_name, skill_level FROM students;

-- Check availability
SELECT COUNT(*) as availability_count FROM instructor_availability;

-- Check lessons
SELECT date, time, discipline FROM lessons ORDER BY date, time;
```

## 🔄 Customization

To customize the test data, edit the `testData` object in `seed-database.ts`:

```typescript
const testData = {
  schools: [
    {
      name: 'Your School Name',
      location: 'Your Location',
      // ... other fields
    }
  ],
  instructors: [
    {
      first_name: 'Your',
      last_name: 'Instructor',
      // ... other fields
    }
  ],
  // ... etc
};
```

## 📝 Notes

- The script uses `supabaseAdmin` to bypass RLS policies
- All data is created with proper foreign key relationships
- Availability is created for the next 7 days from today
- Sample lessons are created for today and tomorrow
- The script is idempotent - running it multiple times is safe

## 🆘 Need Help?

If you encounter issues:

1. Check the console output for specific error messages
2. Verify your database connection
3. Ensure all migrations are applied
4. Check the database logs
5. Review the script source code for details

---

**Happy Testing! 🏄‍♂️**
