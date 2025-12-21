import { select, spinner, isCancel } from "@clack/prompts";
import { getAllClasses } from "../../services/class.service";
import { getAllStudents, getAllGuardians } from "../../services/guardian.service";
import { getAllEnrollments } from "../../services/enrollment.service";
import { getAllPayments } from "../../services/payment.service";
import { db } from "../../db/index";
import { levels, slots } from "../../db/schema";

type Spinner = ReturnType<typeof spinner>;

export async function handleLists() {
  const listType = await select({
    message: "What would you like to view?",
    options: [
      { value: "classes", label: "All Classes" },
      { value: "students", label: "All Students" },
      { value: "guardians", label: "All Guardians" },
      { value: "enrollments", label: "All Enrollments" },
      { value: "payments", label: "All Payments" },
      { value: "levels", label: "Levels & Slots" },
      { value: "back", label: "Back" },
    ],
  });

  if (isCancel(listType) || listType === "back") return;

  const s = spinner();

  switch (listType) {
    case "classes":
      await showAllClasses(s);
      break;
    case "students":
      await showAllStudents(s);
      break;
    case "guardians":
      await showAllGuardians(s);
      break;
    case "enrollments":
      await showAllEnrollments(s);
      break;
    case "payments":
      await showAllPayments(s);
      break;
    case "levels":
      await showLevelsAndSlots(s);
      break;
  }
}

async function showAllClasses(s: Spinner) {
  s.start("Loading classes...");
  const classes = await getAllClasses();
  s.stop();

  if (classes.length === 0) {
    console.log("\nNo classes found.");
    return;
  }

  console.log("\nAll Classes:");
  const tableData = classes.map((c) => ({
    Status: c.availableSpots > 0 ? "OK" : "FULL",
    Level: c.level.label,
    Day: c.slot.day,
    Period: c.slot.period,
    Group: c.groupName,
    Enrolled: c.enrolledCount,
    Capacity: c.capacityMax,
    Available: c.availableSpots,
  }));
  console.table(tableData, Object.keys(tableData[0]));
  console.log(`\nTotal: ${classes.length} classes`);
  console.log("\nClass IDs:");
  classes.forEach((c, i) => {
    console.log(`[${i}] ${c.id} - ${c.groupName}`);
  });
}

async function showAllStudents(s: Spinner) {
  s.start("Loading students...");
  const students = await getAllStudents();
  s.stop();

  if (students.length === 0) {
    console.log("\nNo students found.");
    return;
  }

  console.log("\nAll Students:");
  const tableData = students.map((student) => ({
    Status: student.folderStatus,
    "First Name": student.firstName,
    "Last Name": student.lastName,
    "Birth Date": student.birthDate,
    Gender: student.gender,
    Guardians: student.familyLinks.length,
  }));
  console.table(tableData, Object.keys(tableData[0]));
  console.log(`\nTotal: ${students.length} students`);
  console.log("\nStudent IDs:");
  students.forEach((student, i) => {
    console.log(`[${i}] ${student.id} - ${student.firstName} ${student.lastName}`);
  });
}

async function showAllGuardians(s: Spinner) {
  s.start("Loading guardians...");
  const guardians = await getAllGuardians();
  s.stop();

  if (guardians.length === 0) {
    console.log("\nNo guardians found.");
    return;
  }

  console.log("\nAll Guardians:");
  const tableData = guardians.map((g) => ({
    Type: g.type,
    "First Name": g.firstName,
    "Last Name": g.lastName,
    Phone: g.mobilePhone,
    Students: g.familyLinks.length,
  }));
  console.table(tableData, Object.keys(tableData[0]));
  console.log(`\nTotal: ${guardians.length} guardians`);
  console.log("\nGuardian IDs:");
  guardians.forEach((g, i) => {
    console.log(`[${i}] ${g.id} - ${g.firstName} ${g.lastName}`);
  });
}

async function showAllEnrollments(s: Spinner) {
  s.start("Loading enrollments...");
  const enrollments = await getAllEnrollments();
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

async function showAllPayments(s: Spinner) {
  s.start("Loading payments...");
  const payments = await getAllPayments();
  s.stop();

  if (payments.length === 0) {
    console.log("\nNo payments found.");
    return;
  }

  console.log("\nAll Payments:");
  const tableData = payments.map((p) => ({
    Status: p.status,
    Student: `${p.enrollment.student.firstName} ${p.enrollment.student.lastName}`,
    Amount: `${p.amount} DH`,
    Method: p.method,
    Period: p.period,
    Date: p.paymentDate.split("T")[0],
  }));
  console.table(tableData, Object.keys(tableData[0]));
  console.log(`\nTotal: ${payments.length} payments`);
  console.log("\nPayment IDs:");
  payments.forEach((p, i) => {
    console.log(`[${i}] ${p.id} - ${p.enrollment.student.firstName} ${p.enrollment.student.lastName}`);
  });
}

async function showLevelsAndSlots(s: Spinner) {
  s.start("Loading levels & slots...");
  const allLevels = await db.select().from(levels);
  const allSlots = await db.select().from(slots);
  s.stop();

  console.log("\nLevels:");
  console.table(allLevels.map((l) => ({ Label: l.label })));

  console.log("\nSlots:");
  const slotData = allSlots.map((sl) => ({
    Day: sl.day,
    Period: sl.period,
    "Start Time": sl.startTime,
    "End Time": sl.endTime,
  }));
  console.table(slotData);
}