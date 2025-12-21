import { select, text, spinner } from "@clack/prompts";
import {
  createEnrollment,
  validateEnrollment,
  getEnrollmentWithDetails,
  getAllEnrollments,
} from "../../services/enrollment.service";

export async function handleEnrollmentManagement() {
  const action = await select({
    message: "Enrollment Management:",
    options: [
      { value: "list", label: "📋 List All Enrollments" },
      { value: "create", label: "Create Enrollment (Capacity Check)" },
      { value: "validate", label: "Validate Enrollment" },
      { value: "view", label: "View Enrollment Details" },
    ],
  });

  switch (action) {
    case "list":
      await listEnrollments();
      break;
    case "create":
      await createNewEnrollment();
      break;
    case "validate":
      await validateExistingEnrollment();
      break;
    case "view":
      await viewEnrollmentDetails();
      break;
  }
}

async function listEnrollments() {
  const year = await text({
    message: "Academic Year (leave empty for all):",
    placeholder: "2025",
  });

  const s = spinner();
  s.start("Loading enrollments...");

  const enrollments = year
    ? await getAllEnrollments(parseInt(year as string))
    : await getAllEnrollments();
  s.stop();

  console.log("\n📝 All Enrollments:");
  console.log("─".repeat(100));
  enrollments.forEach((e) => {
    const statusIcon = e.status === "VALIDATED" ? "✅" : e.status === "PENDING" ? "⏳" : "❌";
    const paymentCount = e.payments.length;
    console.log(
      `${statusIcon} ${e.student.firstName} ${e.student.lastName} | ${e.class.level.label} - ${e.class.groupName} | ${e.status} | ${paymentCount} payment(s)`
    );
    console.log(`   ID: ${e.id} | Year: ${e.academicYear}`);
  });
  console.log("─".repeat(100));
}

async function createNewEnrollment() {
  const studentId = await text({
    message: "Student ID:",
  });

  const classId = await text({
    message: "Class ID:",
  });

  const academicYear = await text({
    message: "Academic Year:",
    placeholder: "2025",
  });

  const type = await select({
    message: "Enrollment Type:",
    options: [
      { value: "NEW", label: "New Enrollment" },
      { value: "RE_ENROLLMENT", label: "Re-enrollment" },
    ],
  });

  const s = spinner();
  s.start("Creating enrollment...");

  const result = await createEnrollment({
    studentId: studentId as string,
    classId: classId as string,
    academicYear: parseInt(academicYear as string),
    type: type as "NEW" | "RE_ENROLLMENT",
  });

  if (result.success) {
    s.stop(`✅ ${result.message}`);
    console.log(`   Enrollment ID: ${result.enrollment?.id}`);
  } else {
    s.stop(`❌ ${result.message}`);
  }
}

async function validateExistingEnrollment() {
  const enrollmentId = await text({
    message: "Enrollment ID:",
  });

  const s = spinner();
  s.start("Validating enrollment...");

  const result = await validateEnrollment(enrollmentId as string);

  if (result.success) {
    s.stop(`✅ ${result.message}`);
  } else {
    s.stop(`❌ ${result.message}`);
  }
}

async function viewEnrollmentDetails() {
  const enrollmentId = await text({
    message: "Enrollment ID:",
  });

  const enrollment = await getEnrollmentWithDetails(enrollmentId as string);
  if (enrollment) {
    console.log(`\n📝 Enrollment Details:`);
    console.log(`   Student: ${enrollment.student.firstName} ${enrollment.student.lastName}`);
    console.log(`   Class: ${enrollment.class.groupName}`);
    console.log(`   Level: ${enrollment.class.level.label}`);
    console.log(`   Status: ${enrollment.status}`);
    console.log(`   Payments: ${enrollment.payments.length}`);
  }
}
