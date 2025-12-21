import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createStudent,
  createGuardian,
  findGuardianByPhone,
  linkGuardianToStudent,
} from "../services/guardian.service";
import {
  checkReEnrollmentEligibility,
  createPriorityEnrollment,
  createEnrollment,
} from "../services/enrollment.service";
import { createPayment, getUnpaidStudents } from "../services/payment.service";
import { createClass } from "../services/class.service";
import { db } from "../db/index";
import { levels, slots, classes, students, guardians, enrollments, payments } from "../db/schema";
import { eq } from "drizzle-orm";

describe("Phase 1 Features", () => {
  let testLevelId: string;
  let testSlotId: string;
  let testClassId: string;
  let testGuardianId: string;
  let testStudentId: string;
  let testStudent2Id: string;

  beforeAll(async () => {
    const level = await db.query.levels.findFirst({
      where: eq(levels.label, "Niveau 1"),
    });
    const slot = await db.query.slots.findFirst({
      where: eq(slots.day, "SATURDAY"),
    });

    testLevelId = level!.id;
    testSlotId = slot!.id;

    const classResult = await createClass({
      levelId: testLevelId,
      slotId: testSlotId,
      groupName: "Phase 1 Test Group",
      capacityMax: 20,
    });
    testClassId = classResult.id;
  });

  afterAll(async () => {
    await db.delete(payments).where(eq(payments.enrollmentId, testClassId));
    await db.delete(enrollments).where(eq(enrollments.classId, testClassId));
    await db.delete(students).where(eq(students.id, testStudentId));
    if (testStudent2Id) {
      await db.delete(students).where(eq(students.id, testStudent2Id));
    }
    await db.delete(guardians).where(eq(guardians.id, testGuardianId));
    await db.delete(classes).where(eq(classes.id, testClassId));
  });

  describe("Guardian Phone Lookup", () => {
    it("should create guardian with unique phone number", async () => {
      const guardian = await createGuardian({
        type: "FATHER",
        firstName: "Omar",
        lastName: "TestPhase1",
        mobilePhone: "+212600000001",
      });

      expect(guardian).toBeDefined();
      expect(guardian.mobilePhone).toBe("+212600000001");

      testGuardianId = guardian.id;
    });

    it("should find existing guardian by phone number", async () => {
      const found = await findGuardianByPhone("+212600000001");

      expect(found).toBeDefined();
      expect(found?.id).toBe(testGuardianId);
      expect(found?.firstName).toBe("Omar");
    });

    it("should return null for non-existent phone number", async () => {
      const found = await findGuardianByPhone("+212699999999");

      expect(found).toBeUndefined();
    });

    it("should link new student to existing guardian without duplication", async () => {
      const student = await createStudent({
        firstName: "Amina",
        lastName: "TestPhase1",
        birthDate: "2012-06-15",
        gender: "FEMALE",
      });

      testStudentId = student.id;

      const existingGuardian = await findGuardianByPhone("+212600000001");
      expect(existingGuardian).toBeDefined();

      await linkGuardianToStudent(existingGuardian!.id, student.id);

      const guardianWithStudents = await findGuardianByPhone("+212600000001");
      expect(guardianWithStudents?.familyLinks.length).toBe(1);

      const allGuardians = await db
        .select()
        .from(guardians)
        .where(eq(guardians.mobilePhone, "+212600000001"));

      expect(allGuardians.length).toBe(1);
    });
  });

  describe("Priority Re-enrollment Logic", () => {
    it("should check re-enrollment eligibility for new student", async () => {
      const eligibility = await checkReEnrollmentEligibility(testStudentId, 2025);

      expect(eligibility.isReturning).toBe(false);
      expect(eligibility.isPriority).toBe(false);
      expect(eligibility.lastAcademicYear).toBeNull();
      expect(eligibility.totalYears).toBe(0);
    });

    it("should create first enrollment without priority", async () => {
      const result = await createEnrollment({
        studentId: testStudentId,
        classId: testClassId,
        academicYear: 2024,
        type: "NEW",
      });

      expect(result.success).toBe(true);
      expect(result.enrollment?.type).toBe("NEW");

      await createPayment({
        enrollmentId: result.enrollment!.id,
        amount: "500",
        method: "CASH",
        period: "REGISTRATION",
      });

      await db
        .update(enrollments)
        .set({ status: "VALIDATED" })
        .where(eq(enrollments.id, result.enrollment!.id));
    });

    it("should detect returning student with priority for next year", async () => {
      const eligibility = await checkReEnrollmentEligibility(testStudentId, 2025);

      expect(eligibility.isReturning).toBe(true);
      expect(eligibility.isPriority).toBe(true);
      expect(eligibility.lastAcademicYear).toBe(2024);
      expect(eligibility.totalYears).toBe(1);
    });

    it("should create priority re-enrollment for returning student", async () => {
      const result = await createPriorityEnrollment({
        studentId: testStudentId,
        classId: testClassId,
        academicYear: 2025,
        type: "RE_ENROLLMENT",
      });

      expect(result.success).toBe(true);
      expect(result.enrollment?.type).toBe("RE_ENROLLMENT");
      expect(result.message).toContain("Priority");
      expect(result.message).toContain("1 years");
    });

    it("should not give priority if gap year exists", async () => {
      const student2 = await createStudent({
        firstName: "Khalid",
        lastName: "GapYear",
        birthDate: "2011-08-20",
        gender: "MALE",
      });

      testStudent2Id = student2.id;

      const enrollment2023 = await createEnrollment({
        studentId: student2.id,
        classId: testClassId,
        academicYear: 2023,
        type: "NEW",
      });

      await db
        .update(enrollments)
        .set({ status: "VALIDATED" })
        .where(eq(enrollments.id, enrollment2023.enrollment!.id));

      const eligibility = await checkReEnrollmentEligibility(student2.id, 2025);

      expect(eligibility.isReturning).toBe(true);
      expect(eligibility.isPriority).toBe(false);
      expect(eligibility.lastAcademicYear).toBe(2023);
    });
  });

  describe("Unpaid Students Dashboard", () => {
    it("should generate unpaid students report for academic year", async () => {
      const report = await getUnpaidStudents(2024, 2000);

      expect(report.academicYear).toBe(2024);
      expect(report.students.length).toBeGreaterThan(0);

      const unpaidStudent = report.students.find((s) => s.studentId === testStudentId);
      expect(unpaidStudent).toBeDefined();
      expect(unpaidStudent?.balance).toBeGreaterThan(0);
    });

    it("should calculate correct balance for each student", async () => {
      const report = await getUnpaidStudents(2024, 2000);

      const unpaidStudent = report.students.find((s) => s.studentId === testStudentId);

      expect(unpaidStudent?.totalPaid).toBe(500);
      expect(unpaidStudent?.balance).toBe(1500);
      expect(unpaidStudent?.paymentCount).toBe(1);
    });

    it("should exclude fully paid students from report", async () => {
      const enrollmentWithPayments = await db.query.enrollments.findFirst({
        where: eq(enrollments.studentId, testStudentId),
      });

      if (enrollmentWithPayments) {
        await createPayment({
          enrollmentId: enrollmentWithPayments.id,
          amount: "500",
          method: "CASH",
          period: "REGISTRATION",
        });

        await createPayment({
          enrollmentId: enrollmentWithPayments.id,
          amount: "500",
          method: "CASH",
          period: "Q1",
        });

        await createPayment({
          enrollmentId: enrollmentWithPayments.id,
          amount: "500",
          method: "CASH",
          period: "Q2",
        });

        await createPayment({
          enrollmentId: enrollmentWithPayments.id,
          amount: "500",
          method: "CASH",
          period: "Q3",
        });

        const report = await getUnpaidStudents(2025, 2000);

        const paidStudent = report.students.find((s) => s.studentId === testStudentId);
        expect(paidStudent).toBeUndefined();
      }
    });

    it("should sort students by highest debt first", async () => {
      const report = await getUnpaidStudents(2025, 2000);

      if (report.students.length > 1) {
        for (let i = 0; i < report.students.length - 1; i++) {
          expect(report.students[i].balance).toBeGreaterThanOrEqual(
            report.students[i + 1].balance
          );
        }
      }
    });

    it("should flag students with bounced payments", async () => {
      const report = await getUnpaidStudents(2025, 2000);

      report.students.forEach((student) => {
        expect(student.hasBouncedPayments).toBeDefined();
        expect(typeof student.hasBouncedPayments).toBe("boolean");
      });
    });

    it("should calculate total debt across all unpaid students", async () => {
      const report = await getUnpaidStudents(2025, 2000);

      const manualTotal = report.students.reduce((sum, s) => sum + s.balance, 0);

      expect(report.totalDebt).toBe(manualTotal);
    });
  });
});
