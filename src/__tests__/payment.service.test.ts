import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createPayment,
  markPaymentAsBounced,
  getEnrollmentBalance,
} from "../services/payment.service";
import { createStudent, createGuardian, linkGuardianToStudent } from "../services/guardian.service";
import { createEnrollment, validateEnrollment } from "../services/enrollment.service";
import { createClass } from "../services/class.service";
import { db } from "../db/index";
import { levels, slots, classes, students, enrollments, payments } from "../db/schema";
import { eq } from "drizzle-orm";

describe("Payment Service - Complete Financial Engine", () => {
  let testStudentId: string;
  let testStudent2Id: string;
  let testEnrollmentId: string;
  let testEnrollment2Id: string;
  let testPaymentId: string;
  let testClassId: string;
  let testGuardianId: string;

  beforeAll(async () => {
    const level = await db.query.levels.findFirst({
      where: eq(levels.label, "Niveau 1"),
    });
    const slot = await db.query.slots.findFirst({
      where: eq(slots.day, "SUNDAY"),
    });

    const classResult = await createClass({
      levelId: level!.id,
      slotId: slot!.id,
      groupName: "Payment Test Group",
      capacityMax: 20,
    });
    testClassId = classResult.id;

    // Create guardian and students for family testing
    const guardian = await createGuardian({
      type: "FATHER",
      firstName: "Hassan",
      lastName: "TestFamily",
      mobilePhone: "+212612345678",
    });
    testGuardianId = guardian.id;

    const student = await createStudent({
      firstName: "Fatima",
      lastName: "PaymentTest",
      birthDate: "2012-03-20",
      gender: "FEMALE",
    });
    testStudentId = student.id;
    await linkGuardianToStudent(testGuardianId, testStudentId);

    const student2 = await createStudent({
      firstName: "Youssef",
      lastName: "PaymentTest",
      birthDate: "2014-05-15",
      gender: "MALE",
    });
    testStudent2Id = student2.id;
    await linkGuardianToStudent(testGuardianId, testStudent2Id);

    const enrollment = await createEnrollment({
      studentId: testStudentId,
      classId: testClassId,
      academicYear: 2025,
      type: "NEW",
    });
    testEnrollmentId = enrollment.enrollment!.id;

    const enrollment2 = await createEnrollment({
      studentId: testStudent2Id,
      classId: testClassId,
      academicYear: 2025,
      type: "NEW",
    });
    testEnrollment2Id = enrollment2.enrollment!.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(payments).where(eq(payments.enrollmentId, testEnrollmentId));
    await db.delete(payments).where(eq(payments.enrollmentId, testEnrollment2Id));
    await db.delete(enrollments).where(eq(enrollments.id, testEnrollmentId));
    await db.delete(enrollments).where(eq(enrollments.id, testEnrollment2Id));
    await db.delete(students).where(eq(students.id, testStudentId));
    await db.delete(students).where(eq(students.id, testStudent2Id));
    await db.delete(classes).where(eq(classes.id, testClassId));
  });

  describe("Enrollment Lifecycle - Payment Validation", () => {
    it("should validate enrollment automatically on REGISTRATION payment", async () => {
      const payment = await createPayment({
        enrollmentId: testEnrollmentId,
        amount: "500",
        method: "CASH",
        period: "REGISTRATION",
      });

      expect(payment.status).toBe("COMPLETED");

      const result = await validateEnrollment(testEnrollmentId);
      expect(result.success).toBe(true);
      expect(result.enrollment?.status).toBe("VALIDATED");

      testPaymentId = payment.id;
    });

    it("should not validate enrollment without registration payment", async () => {
      const result = await validateEnrollment(testEnrollment2Id);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Registration payment not completed");
    });
  });

  describe("Automated Bounced Check Trigger - CRITICAL", () => {
    it("should trigger folder block immediately when check bounces", async () => {
      const studentBefore = await db.query.students.findFirst({
        where: eq(students.id, testStudentId),
      });
      expect(studentBefore?.folderStatus).toBe("ACTIVE");

      const result = await markPaymentAsBounced(testPaymentId);

      expect(result.success).toBe(true);
      expect(result.message).toContain("BLOCKED");

      const studentAfter = await db.query.students.findFirst({
        where: eq(students.id, testStudentId),
      });

      expect(studentAfter?.folderStatus).toBe("BLOCKED");
    });

    it("should prevent blocked student from new enrollments", async () => {
    //   const level = await db.query.levels.findFirst({
    //     where: eq(levels.label, "Niveau 2"),
    //   });

      const newEnrollmentAttempt = await createEnrollment({
        studentId: testStudentId,
        classId: testClassId,
        academicYear: 2026,
        type: "RE_ENROLLMENT",
      });

      expect(newEnrollmentAttempt.success).toBe(false);
      expect(newEnrollmentAttempt.message).toContain("blocked");
    });

    it("should alert administrator about bounced payment details", async () => {
      const result = await markPaymentAsBounced(testPaymentId);

      expect(result.studentId).toBeDefined();
      expect(result.studentName).toContain("Fatima");
      expect(result.studentName).toContain("PaymentTest");
    });
  });

  describe("Financial Calculations", () => {
    it("should calculate correct remaining balance", async () => {
      const balance = await getEnrollmentBalance(testEnrollmentId, 2000);

      expect(balance.totalPaid).toBe(0);
      expect(balance.expectedTotal).toBe(2000);
      expect(balance.balance).toBe(2000);
      expect(balance.paymentsByPeriod["REGISTRATION"]).toBeDefined();
      expect(balance.paymentsByPeriod["REGISTRATION"].status).toBe("BOUNCED");
    });

    it("should ignore BOUNCED payments in balance calculation", async () => {
      await createPayment({
        enrollmentId: testEnrollment2Id,
        amount: "500",
        method: "CASH",
        period: "REGISTRATION",
      });

      await createPayment({
        enrollmentId: testEnrollment2Id,
        amount: "400",
        method: "CASH",
        period: "Q1",
      });

      const balance = await getEnrollmentBalance(testEnrollment2Id, 2000);

      expect(balance.totalPaid).toBe(900);
      expect(balance.balance).toBe(1100);
    });

    it("should track payments by period correctly", async () => {
      await createPayment({
        enrollmentId: testEnrollment2Id,
        amount: "400",
        method: "CASH",
        period: "Q2",
      });

      const balance = await getEnrollmentBalance(testEnrollment2Id, 2000);

      expect(balance.paymentsByPeriod["REGISTRATION"]).toBeDefined();
      expect(balance.paymentsByPeriod["Q1"]).toBeDefined();
      expect(balance.paymentsByPeriod["Q2"]).toBeDefined();
      expect(balance.paymentsByPeriod["REGISTRATION"].amount).toBe(500);
      expect(balance.paymentsByPeriod["Q1"].amount).toBe(400);
      expect(balance.paymentsByPeriod["Q2"].amount).toBe(400);
    });

    it("should ignore PENDING payments in total calculation", async () => {
      const pendingPayment = await createPayment({
        enrollmentId: testEnrollment2Id,
        amount: "1000",
        method: "CHECK",
        period: "Q3",
      });

      await db
        .update(payments)
        .set({ status: "PENDING" })
        .where(eq(payments.id, pendingPayment.id));

      const balance = await getEnrollmentBalance(testEnrollment2Id, 2000);

      expect(balance.totalPaid).toBe(1300);
      expect(balance.paymentsByPeriod["Q3"].status).toBe("PENDING");
    });
  });

  describe("Multi-Student Family Handling", () => {
    it("should track multiple students under same guardian", async () => {
      const student1Enrollment = await db.query.enrollments.findFirst({
        where: eq(enrollments.id, testEnrollmentId),
        with: {
          student: {
            with: {
              familyLinks: {
                with: {
                  guardian: true,
                },
              },
            },
          },
        },
      });

      const student2Enrollment = await db.query.enrollments.findFirst({
        where: eq(enrollments.id, testEnrollment2Id),
        with: {
          student: {
            with: {
              familyLinks: {
                with: {
                  guardian: true,
                },
              },
            },
          },
        },
      });

      expect(student1Enrollment?.student.familyLinks[0].guardianId).toBe(testGuardianId);
      expect(student2Enrollment?.student.familyLinks[0].guardianId).toBe(testGuardianId);
    });
  });
});

