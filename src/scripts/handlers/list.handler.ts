import { select, spinner } from "@clack/prompts";
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
    ],
  });

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

  console.log("\nAll Classes:");
  console.log("─".repeat(100));
  classes.forEach((c) => {
    const status = c.availableSpots > 0 ? "[OK]" : "[FULL]";
    console.log(
      `${status} ${c.level.label.padEnd(12)} | ${c.slot.day.padEnd(10)} ${c.slot.period.padEnd(10)} | ${c.groupName.padEnd(15)} | ${c.enrolledCount}/${c.capacityMax}`
    );
  });
  console.log("─".repeat(100));
}

async function showAllStudents(s: Spinner) {
  s.start("Loading students...");
  const students = await getAllStudents();
  s.stop();

  console.log("\nAll Students:");
  console.log("─".repeat(100));
  students.forEach((student) => {
    const statusIcon = student.folderStatus === "ACTIVE" ? "[ACTIVE]" : "[BLOCKED]";
    console.log(
      `${statusIcon} ${student.firstName} ${student.lastName} | ${student.birthDate} | ${student.gender} | ${student.familyLinks.length} guardian(s)`
    );
  });
  console.log("─".repeat(100));
}

async function showAllGuardians(s: Spinner) {
  s.start("Loading guardians...");
  const guardians = await getAllGuardians();
  s.stop();

  console.log("\nAll Guardians:");
  console.log("─".repeat(100));
  guardians.forEach((g) => {
    console.log(
      `${g.type} | ${g.firstName} ${g.lastName} | ${g.mobilePhone} | ${g.familyLinks.length} student(s)`
    );
  });
  console.log("─".repeat(100));
}

async function showAllEnrollments(s: Spinner) {
  s.start("Loading enrollments...");
  const enrollments = await getAllEnrollments();
  s.stop();

  console.log("\nAll Enrollments:");
  console.log("─".repeat(100));
  enrollments.forEach((e) => {
    const statusIcon = e.status === "VALIDATED" ? "[VALIDATED]" : e.status === "PENDING" ? "[PENDING]" : "[CANCELLED]";
    console.log(
      `${statusIcon} ${e.student.firstName} ${e.student.lastName} | ${e.class.level.label} - ${e.class.groupName} | ${e.status} | Year ${e.academicYear}`
    );
  });
  console.log("─".repeat(100));
}

async function showAllPayments(s: Spinner) {
  s.start("Loading payments...");
  const payments = await getAllPayments();
  s.stop();

  console.log("\nAll Payments:");
  console.log("─".repeat(100));
  payments.forEach((p) => {
    const statusIcon = p.status === "COMPLETED" ? "[COMPLETED]" : p.status === "BOUNCED" ? "[BOUNCED]" : "[PENDING]";
    console.log(
      `${statusIcon} ${p.enrollment.student.firstName} ${p.enrollment.student.lastName} | ${p.amount} DH | ${p.period} | ${p.status}`
    );
  });
  console.log("─".repeat(100));
}

async function showLevelsAndSlots(s: Spinner) {
  s.start("Loading levels & slots...");
  const allLevels = await db.select().from(levels);
  const allSlots = await db.select().from(slots);
  s.stop();

  console.log("\nLevels:");
  allLevels.forEach((l) => console.log(`   - ${l.label}`));

  console.log("\nSlots:");
  allSlots.forEach((s) =>
    console.log(`   - ${s.day} | ${s.period} | ${s.startTime} - ${s.endTime}`)
  );
}