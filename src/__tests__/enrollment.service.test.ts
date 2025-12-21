import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createEnrollment,
  validateEnrollment,
  getEnrollmentWithDetails,
} from "../services/enrollment.service";
import { createStudent } from "../services/guardian.service";
import { createPayment } from "../services/payment.service";
import { createClass } from "../services/class.service";
import { db } from "../db/index";
import { levels, slots, classes, students, enrollments } from "../db/schema";
import { eq, and } from "drizzle-orm";

describe("Enrollment Service - Complete Business Logic", () => {
  let testStudentId: string;
  let testStudentId2: string;
  let testClassId: string;
  let testClassGroupBId: string;
  let testEnrollmentId: string;
  let testLevelId: string;
  let testSlotId: string;
  let blockedStudentId: string;

  beforeAll(async () => {
    const level = await db.query.levels.findFirst({
      where: eq(levels.label, "CP"),
    });
    const slot = await db.query.slots.findFirst({
      where: eq(slots.day, "SATURDAY"),
    });

    testLevelId = level!.id;
    testSlotId = slot!.id;

    // Create a class with small capacity for testing
    const classA = await createClass({
      levelId: testLevelId,
      slotId: testSlotId,
      groupName: "Test Group A - Small",
      capacityMax: 2,
    });
    testClassId = classA.id;

    // Create Group B for multi-group logic testing
    const classB = await createClass({
      levelId: testLevelId,
      slotId: testSlotId,
      groupName: "Test Group B",
      capacityMax: 20,
    });
    testClassGroupBId = classB.id;

    // Create test students
    const student = await createStudent({
      firstName: "Ahmed",
      lastName: "EnrollmentTest",
      birthDate: "2010-05-15",
      gender: "MALE",
    });
    testStudentId = student.id;

    const student2 = await createStudent({
      firstName: "Fatima",
      lastName: "EnrollmentTest2",
      birthDate: "2011-03-20",
      gender: "FEMALE",
    });
    testStudentId2 = student2.id;

    // Create blocked student
    const blockedStudent = await createStudent({
      firstName: "Blocked",
      lastName: "Student",
      birthDate: "2009-01-10",
      gender: "MALE",
    });
    blockedStudentId = blockedStudent.id;

    // Block the student
    await db
      .update(students)
      .set({ folderStatus: "BLOCKED" })
      .where(eq(students.id, blockedStudentId));
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(enrollments).where(eq(enrollments.studentId, testStudentId));
    await db.delete(enrollments).where(eq(enrollments.studentId, testStudentId2));
    await db.delete(students).where(eq(students.id, testStudentId));
    await db.delete(students).where(eq(students.id, testStudentId2));
    await db.delete(students).where(eq(students.id, blockedStudentId));
    await db.delete(classes).where(eq(classes.id, testClassId));
    await db.delete(classes).where(eq(classes.id, testClassGroupBId));
  });

  describe("Capacity Validation", () => {
    it("should allow enrollment when class has available capacity", async () => {
      const result = await createEnrollment({
        studentId: testStudentId,
        classId: testClassId,
        academicYear: 2025,
        type: "NEW",
      });

      expect(result.success).toBe(true);
      expect(result.enrollment?.status).toBe("PENDING");
      expect(result.message).toContain("PENDING");

      testEnrollmentId = result.enrollment!.id;
    });

    it("should reject enrollment when class is at capacity", async () => {
      // Fill the class to capacity (capacity is 2)
      const student2Enrollment = await createEnrollment({
        studentId: testStudentId2,
        classId: testClassId,
        academicYear: 2025,
        type: "NEW",
      });

      // Validate both enrollments to count them
      await createPayment({
        enrollmentId: testEnrollmentId,
        amount: "500",
        method: "CASH",
        period: "REGISTRATION",
      });
      await validateEnrollment(testEnrollmentId);

      await createPayment({
        enrollmentId: student2Enrollment.enrollment!.id,
        amount: "500",
        method: "CASH",
        period: "REGISTRATION",
      });
      await validateEnrollment(student2Enrollment.enrollment!.id);

      // Try to enroll a third student (should fail)
      const student3 = await createStudent({
        firstName: "Third",
        lastName: "Student",
        birthDate: "2010-06-15",
        gender: "MALE",
      });

      const result = await createEnrollment({
        studentId: student3.id,
        classId: testClassId,
        academicYear: 2025,
        type: "NEW",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("full");

      // Cleanup
      await db.delete(students).where(eq(students.id, student3.id));
    });
  });

  describe("Multi-Group Logic", () => {
    it("should identify available groups when Group A is full", async () => {
      // Group A is now full, should suggest Group B
      const student4 = await createStudent({
        firstName: "Fourth",
        lastName: "MultiGroup",
        birthDate: "2010-07-20",
        gender: "FEMALE",
      });

      const resultGroupB = await createEnrollment({
        studentId: student4.id,
        classId: testClassGroupBId,
        academicYear: 2025,
        type: "NEW",
      });

      expect(resultGroupB.success).toBe(true);
      expect(resultGroupB.enrollment?.classId).toBe(testClassGroupBId);

      // Cleanup
      await db.delete(enrollments).where(eq(enrollments.studentId, student4.id));
      await db.delete(students).where(eq(students.id, student4.id));
    });

    it("should isolate group counts - enrolling in Group B should not affect Group A", async () => {
      const groupAEnrollments = await db.query.enrollments.findMany({
        where: and(
          eq(enrollments.classId, testClassId),
          eq(enrollments.status, "VALIDATED")
        ),
      });

      const groupBEnrollments = await db.query.enrollments.findMany({
        where: and(
          eq(enrollments.classId, testClassGroupBId),
          eq(enrollments.status, "VALIDATED")
        ),
      });

      expect(groupAEnrollments.length).toBe(2);
      expect(groupBEnrollments.length).toBe(0);
    });
  });

  describe("Student Status Constraints", () => {
    it("should block enrollment for BLOCKED students", async () => {
      const result = await createEnrollment({
        studentId: blockedStudentId,
        classId: testClassGroupBId,
        academicYear: 2025,
        type: "NEW",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("blocked");
    });
  });

  describe("Data Integrity", () => {
    it("should prevent duplicate annual enrollment", async () => {
      const result = await createEnrollment({
        studentId: testStudentId,
        classId: testClassGroupBId,
        academicYear: 2025,
        type: "NEW",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("already enrolled");
    });

    it("should allow enrollment in different academic year", async () => {
      const result = await createEnrollment({
        studentId: testStudentId,
        classId: testClassGroupBId,
        academicYear: 2026,
        type: "RE_ENROLLMENT",
      });

      expect(result.success).toBe(true);

      // Cleanup
      await db
        .delete(enrollments)
        .where(
          and(
            eq(enrollments.studentId, testStudentId),
            eq(enrollments.academicYear, 2026)
          )
        );
    });
  });

  describe("Enrollment Lifecycle", () => {
    it("should not validate enrollment without registration payment", async () => {
      const student5 = await createStudent({
        firstName: "Fifth",
        lastName: "Lifecycle",
        birthDate: "2010-08-15",
        gender: "MALE",
      });

      const enrollment = await createEnrollment({
        studentId: student5.id,
        classId: testClassGroupBId,
        academicYear: 2025,
        type: "NEW",
      });

      const result = await validateEnrollment(enrollment.enrollment!.id);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Registration payment not completed");

      // Cleanup
      await db.delete(enrollments).where(eq(enrollments.studentId, student5.id));
      await db.delete(students).where(eq(students.id, student5.id));
    });

    it("should get enrollment with full details", async () => {
      const enrollment = await getEnrollmentWithDetails(testEnrollmentId);

      expect(enrollment).toBeDefined();
      expect(enrollment?.student).toBeDefined();
      expect(enrollment?.class).toBeDefined();
      expect(enrollment?.class.level).toBeDefined();
      expect(enrollment?.class.slot).toBeDefined();
      expect(enrollment?.payments.length).toBeGreaterThan(0);
    });
  });
});

