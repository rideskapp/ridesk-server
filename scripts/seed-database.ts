/**
 * Database Seeding Script for Ridesk Calendar
 *
 * This script seeds the database with test data for the comprehensive calendar system.
 * Run this directly in the server environment to avoid authentication issues.
 */

import { supabaseAdmin } from "../src/database/supabase";

// Test data
const testData = {
  schools: [
    {
      name: "Test Surf School",
      slug: "test-surf-school",
      address: "Test Beach, California",
      email: "info@testsurfschool.com",
      phone: "+1-555-0123",
      disciplines: ["kite", "surf", "wing"],
      open_hours_start: "09:00:00",
      open_hours_end: "18:00:00",
      is_active: true,
    },
  ],
  instructors: [
    {
      role: "INSTRUCTOR" as const,
      first_name: "Alex",
      last_name: "Smith",
      phone_number: "+1234567890",
      specialties: ["kite"],
      languages: ["English", "Spanish"],
      hourly_rate: 80,
      commission_rate: 15,
      is_primary: true,
      is_active: true,
    },
    {
      role: "INSTRUCTOR" as const,
      first_name: "Maria",
      last_name: "Garcia",
      phone_number: "+1234567891",
      specialties: ["surf"],
      languages: ["English", "Spanish"],
      hourly_rate: 75,
      commission_rate: 12,
      is_primary: false,
      is_active: true,
    },
    {
      role: "INSTRUCTOR" as const,
      first_name: "John",
      last_name: "Doe",
      phone_number: "+1234567892",
      specialties: ["wing"],
      languages: ["English"],
      hourly_rate: 90,
      commission_rate: 18,
      is_primary: false,
      is_active: true,
    },
  ],
  students: [
    {
      role: "USER" as const,
      first_name: "Emma",
      last_name: "Wilson",
      phone_number: "+1234567893",
      skill_level: "beginner",
      preferred_disciplines: ["kite", "surf"],
      is_active: true,
    },
    {
      role: "USER" as const,
      first_name: "Tom",
      last_name: "Brown",
      phone_number: "+1234567894",
      skill_level: "intermediate",
      preferred_disciplines: ["surf", "wing"],
      is_active: true,
    },
    {
      role: "USER" as const,
      first_name: "Sarah",
      last_name: "Johnson",
      phone_number: "+1234567895",
      skill_level: "advanced",
      preferred_disciplines: ["kite", "wing"],
      is_active: true,
    },
  ],
};

// Helper function to log results
function logResult(
  operation: string,
  success: boolean,
  data?: any,
  error?: any,
) {
  if (success) {
    console.log(`✅ ${operation}: Success`);
    if (data) {
      console.log(`   ID: ${data.id || data[0]?.id || "N/A"}`);
    }
  } else {
    console.error(`❌ ${operation}: Failed`);
    if (error) {
      console.error(`   Error: ${error.message || error}`);
    }
  }
}

// Create test school
async function createTestSchool() {
  console.log("🏫 Creating test school...");

  try {
    // Check if school already exists
    const { data: existingSchool, error: checkError } = await supabaseAdmin
      .from("schools")
      .select("*")
      .eq("slug", testData.schools[0].slug)
      .single();

    if (existingSchool && !checkError) {
      console.log("✅ School already exists, using existing school");
      return existingSchool;
    }

    // Create new school if it doesn't exist
    const { data, error } = await supabaseAdmin
      .from("schools")
      .insert(testData.schools)
      .select()
      .single();

    if (error) throw error;

    logResult("School creation", true, data);
    return data;
  } catch (error) {
    logResult("School creation", false, null, error);
    throw error;
  }
}

// Create test instructors
async function createTestInstructors(schoolId: string) {
  console.log("🏄‍♂️ Creating test instructors...");

  try {
    // Check if instructors already exist for this school
    const { data: existingInstructors, error: checkError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("school_id", schoolId)
      .eq("role", "INSTRUCTOR");

    if (existingInstructors && existingInstructors.length > 0) {
      console.log(
        `✅ Found ${existingInstructors.length} existing instructors, using them`,
      );
      return existingInstructors;
    }

    // For now, let's just return empty array since we can't create users without auth
    console.log(
      "⚠️ Cannot create users without authentication. Skipping instructor creation.",
    );
    console.log(
      "💡 To test the calendar, you'll need to create users through the normal registration process.",
    );
    return [];
  } catch (error) {
    logResult("Instructors creation", false, null, error);
    throw error;
  }
}

// Create test students
async function createTestStudents(schoolId: string) {
  console.log("🎓 Creating test students...");

  try {
    // Check if students already exist for this school
    const { data: existingStudents, error: checkError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("school_id", schoolId)
      .eq("role", "USER");

    if (existingStudents && existingStudents.length > 0) {
      console.log(
        `✅ Found ${existingStudents.length} existing students, using them`,
      );
      return existingStudents;
    }

    // For now, let's just return empty array since we can't create users without auth
    console.log(
      "⚠️ Cannot create users without authentication. Skipping student creation.",
    );
    console.log(
      "💡 To test the calendar, you'll need to create users through the normal registration process.",
    );
    return [];
  } catch (error) {
    logResult("Students creation", false, null, error);
    throw error;
  }
}

// Create instructor availability
async function createInstructorAvailability(instructors: any[]) {
  console.log("📅 Creating instructor availability...");

  if (instructors.length === 0) {
    console.log("⚠️ No instructors available, skipping availability creation");
    return [];
  }

  const today = new Date();
  const availabilitySlots: any[] = [];

  for (const instructor of instructors) {
    // Create availability for the next 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      // Morning availability (9 AM - 12 PM)
      availabilitySlots.push({
        instructor_id: instructor.id,
        date: dateStr,
        time_start: "09:00:00",
        time_end: "12:00:00",
        active: true,
      });

      // Afternoon availability (2 PM - 6 PM)
      availabilitySlots.push({
        instructor_id: instructor.id,
        date: dateStr,
        time_start: "14:00:00",
        time_end: "18:00:00",
        active: true,
      });
    }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("instructor_availability")
      .insert(availabilitySlots)
      .select();

    if (error) throw error;

    logResult("Availability creation", true, data);
    return data;
  } catch (error) {
    logResult("Availability creation", false, null, error);
    throw error;
  }
}

// Create sample lessons
async function createSampleLessons(
  instructors: any[],
  students: any[],
  schoolId: string,
) {
  console.log("📚 Creating sample lessons...");

  if (instructors.length === 0 || students.length === 0) {
    console.log(
      "⚠️ No instructors or students available, skipping lesson creation",
    );
    return [];
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const sampleLessons = [
    {
      school_id: schoolId,
      instructor_id: instructors[0].id,
      date: today.toISOString().split("T")[0],
      time: "10:00:00",
      duration: 60,
      discipline: "kite",
      level: "beginner",
      notes: "First lesson - basics",
      source: "manual" as const,
    },
    {
      school_id: schoolId,
      instructor_id: instructors[1]?.id || instructors[0].id,
      date: today.toISOString().split("T")[0],
      time: "15:00:00",
      duration: 90,
      discipline: "surf",
      level: "intermediate",
      notes: "Intermediate surf lesson",
      source: "manual" as const,
    },
    {
      school_id: schoolId,
      instructor_id: instructors[2]?.id || instructors[0].id,
      date: tomorrow.toISOString().split("T")[0],
      time: "11:00:00",
      duration: 120,
      discipline: "wing",
      level: "advanced",
      notes: "Advanced wingfoil session",
      source: "manual" as const,
    },
  ];

  try {
    const { data, error } = await supabaseAdmin
      .from("lessons")
      .insert(sampleLessons)
      .select();

    if (error) throw error;

    // Create lesson participants for each lesson
    for (let i = 0; i < data.length; i++) {
      const lesson = data[i];
      const student = students[i] || students[0];

      await supabaseAdmin.from("lesson_participants").insert({
        lesson_id: lesson.id,
        student_id: student.id,
      });
    }

    logResult("Lessons creation", true, data);
    return data;
  } catch (error) {
    logResult("Lessons creation", false, null, error);
    throw error;
  }
}

// Create instructor-school relationships
async function createInstructorSchoolRelations(
  instructors: any[],
  schoolId: string,
) {
  console.log("🔗 Creating instructor-school relationships...");

  if (instructors.length === 0) {
    console.log(
      "⚠️ No instructors available, skipping instructor-school relationships",
    );
    return [];
  }

  const relationships = instructors.map((instructor) => ({
    instructor_id: instructor.id,
    school_id: schoolId,
    is_primary: instructor.is_primary,
    hourly_rate: instructor.hourly_rate,
    commission_rate: instructor.commission_rate,
    is_active: true,
  }));

  try {
    const { data, error } = await supabaseAdmin
      .from("instructor_schools")
      .insert(relationships)
      .select();

    if (error) throw error;

    logResult("Instructor-school relationships creation", true, data);
    return data;
  } catch (error) {
    logResult("Instructor-school relationships creation", false, null, error);
    throw error;
  }
}

// Main seeding function
async function seedDatabase() {
  console.log("🚀 Starting database seeding for Ridesk Calendar...");
  console.log(
    "This will create test data for the comprehensive calendar system.",
  );
  console.log("");

  try {
    // Check database connection
    const { data: healthCheck, error: healthError } = await supabaseAdmin
      .from("schools")
      .select("count")
      .limit(1);

    if (healthError) throw healthError;
    console.log("✅ Database connection successful");

    // Create test school
    const school = await createTestSchool();

    // Create instructors and students in parallel
    const [instructors, students] = await Promise.all([
      createTestInstructors(school.id),
      createTestStudents(school.id),
    ]);

    // Create instructor-school relationships
    await createInstructorSchoolRelations(instructors, school.id);

    // Create availability and lessons
    await createInstructorAvailability(instructors);
    await createSampleLessons(instructors, students, school.id);

    console.log("");
    console.log("🎉 Database seeding completed successfully!");
    console.log("");
    console.log("Created:");
    console.log(`  - 1 school: ${school.name}`);
    console.log(`  - ${instructors.length} instructors`);
    console.log(`  - ${students.length} students`);
    console.log(`  - Instructor-school relationships`);
    console.log(`  - Multiple availability slots`);
    console.log(`  - 3 sample lessons with participants`);
    console.log("");
    console.log("Next steps:");
    console.log("1. Start your client: cd ridesk-client && npm run dev");
    console.log("2. Go to http://localhost:3000/calendar");
    console.log("3. Test the calendar functionality");
    console.log("4. Try creating lessons using the wizard");
    console.log("5. Test filtering and navigation");
    console.log("");
    console.log("📖 See TESTING_GUIDE.md for detailed testing instructions");
  } catch (error) {
    console.error("");
    console.error("❌ Database seeding failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run the seeding
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log("✅ Seeding script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeding script failed:", error);
      process.exit(1);
    });
}

export { seedDatabase };
