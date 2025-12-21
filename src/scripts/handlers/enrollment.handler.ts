import { select, text, spinner, isCancel } from "@clack/prompts";
import {
  createEnrollment,
  validateEnrollment,
  getEnrollmentWithDetails,
  getAllEnrollments,
  checkReEnrollmentEligibility,
  createPriorityEnrollment,
} from "../../services/enrollment.service";

export async function handleEnrollmentManagement() {
  const action = await select({
    message: "Enrollment Management:",
    options: [
      { value: "list", label: "List All Enrollments" },
      { value: "create", label: "Create Enrollment (Capacity Check)" },
      { value: "priority", label: "Priority Re-enrollment (Returning Students)" },
      { value: "validate", label: "Validate Enrollment" },
      { value: "view", label: "View Enrollment Details" },
      { value: "back", label: "Back" },
    ],
  });

  if (isCancel(action) || action === "back") return;

  switch (action) {
    case "list":
      await listEnrollments();
      break;
    case "create":
      await createNewEnrollment();
      break;
    case "priority":
      await createPriorityReEnrollment();
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

  if (isCancel(year)) return;

  const s = spinner();
  s.start("Loading enrollments...");

  const enrollments = year
    ? await getAllEnrollments(parseInt(year as string))
    : await getAllEnrollments();
  s.stop();

  if (enrollments.length === 0) {
    console.log("\nNo enrollments found.");
    return;
  }

  console.log("\nAll Enrollments:");
  const tableData = enrollments.map((e) => ({
    Status: e.status,
    Student: `${e.student.firstName} ${e.student.lastName}`,
    Level: e.class.level.label,
    Group: e.class.groupName,
    Year: e.academicYear,
    Type: e.type,
    Payments: e.payments.length,
  }));
  console.table(tableData, Object.keys(tableData[0]));
  console.log(`\nTotal: ${enrollments.length} enrollments`);
  console.log("\nEnrollment IDs:");
  enrollments.forEach((e, i) => {
    console.log(`[${i}] ${e.id} - ${e.student.firstName} ${e.student.lastName}`);
  });
}

async function createNewEnrollment() {
  const studentId = await text({
    message: "Student ID:",
  });

  if (isCancel(studentId)) return;

  const classId = await text({
    message: "Class ID:",
  });

  if (isCancel(classId)) return;

  const academicYear = await text({
    message: "Academic Year:",
    placeholder: "2025",
  });

  if (isCancel(academicYear)) return;

  const type = await select({
    message: "Enrollment Type:",
    options: [
      { value: "NEW", label: "New Enrollment" },
      { value: "RE_ENROLLMENT", label: "Re-enrollment" },
    ],
  });

  if (isCancel(type)) return;

  const s = spinner();
  s.start("Creating enrollment...");

  const result = await createEnrollment({
    studentId: studentId as string,
    classId: classId as string,
    academicYear: parseInt(academicYear as string),
    type: type as "NEW" | "RE_ENROLLMENT",
  });

  if (result.success) {
    s.stop(`Success: ${result.message}`);
    console.log(`   Enrollment ID: ${result.enrollment?.id}`);
  } else {
    s.stop(`Error: ${result.message}`);
  }
}

async function validateExistingEnrollment() {
  const enrollmentId = await text({
    message: "Enrollment ID:",
  });

  if (isCancel(enrollmentId)) return;

  const s = spinner();
  s.start("Validating enrollment...");

  const result = await validateEnrollment(enrollmentId as string);

  if (result.success) {
    s.stop(`Success: ${result.message}`);
  } else {
    s.stop(`Error: ${result.message}`);
  }
}

async function createPriorityReEnrollment() {
  const studentId = await text({
    message: "Student ID:",
  });

  if (isCancel(studentId)) return;

  const academicYear = await text({
    message: "Academic Year:",
    placeholder: "2025",
  });

  if (isCancel(academicYear)) return;

  const s = spinner();
  s.start("Checking re-enrollment eligibility...");

  const eligibility = await checkReEnrollmentEligibility(
    studentId as string,
    parseInt(academicYear as string)
  );

  s.stop();

  console.log("\\nEligibility Status:");
  console.log(`   Returning Student: ${eligibility.isReturning ? "Yes" : "No"}`);
  console.log(`   Priority Status: ${eligibility.isPriority ? "Yes" : "No"}`);
  console.log(`   Last Year: ${eligibility.lastAcademicYear || "N/A"}`);
  console.log(`   Total Years: ${eligibility.totalYears}`);

  if (!eligibility.isPriority) {
    console.log("\\nStudent does not have priority re-enrollment status.");
    return;
  }

  const classId = await text({
    message: "Class ID:",
  });

  if (isCancel(classId)) return;

  const s2 = spinner();
  s2.start("Creating priority re-enrollment...");

  const result = await createPriorityEnrollment({
    studentId: studentId as string,
    classId: classId as string,
    academicYear: parseInt(academicYear as string),
    type: "RE_ENROLLMENT",
  });

  if (result.success) {
    s2.stop(`Success: ${result.message}`);
    console.log(`   Enrollment ID: ${result.enrollment?.id}`);
  } else {
    s2.stop(`Error: ${result.message}`);
  }
}

async function viewEnrollmentDetails() {
  const enrollmentId = await text({
    message: "Enrollment ID:",
  });

  if (isCancel(enrollmentId)) return;

  const enrollment = await getEnrollmentWithDetails(enrollmentId as string);
  if (enrollment) {
    console.log(`\nEnrollment Details:`);
    console.log(`   Student: ${enrollment.student.firstName} ${enrollment.student.lastName}`);
    console.log(`   Class: ${enrollment.class.groupName}`);
    console.log(`   Level: ${enrollment.class.level.label}`);
    console.log(`   Status: ${enrollment.status}`);
    console.log(`   Payments: ${enrollment.payments.length}`);
  }
}
