import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createClass,
  getClassWithAvailability,
  findAvailableClasses,
  checkClassCapacity,
} from "../services/class.service";
import { createStudent } from "../services/guardian.service";
import { createEnrollment, validateEnrollment } from "../services/enrollment.service";
import { createPayment } from "../services/payment.service";
import { db } from "../db/index";
import { levels, slots, classes, enrollments, students } from "../db/schema";
import { eq } from "drizzle-orm";

describe("Class Service - Dynamic Scaling & Structure", () => {
  let testLevelId: string;
  let testSlotId: string;
  let testClassGroupAId: string;
  let testClassGroupBId: string;

  beforeAll(async () => {
    const level = await db.query.levels.findFirst({
      where: eq(levels.label, "CP"),
    });
    const slot = await db.query.slots.findFirst({
      where: eq(slots.day, "WEDNESDAY"),
    });

    testLevelId = level!.id;
    testSlotId = slot!.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(classes).where(eq(classes.id, testClassGroupAId));
    await db.delete(classes).where(eq(classes.id, testClassGroupBId));
  });

  describe("Class Creation & Management", () => {
    it("should create a new class with specified capacity", async () => {
      const newClass = await createClass({
        levelId: testLevelId,
        slotId: testSlotId,
        groupName: "Test Group A",
        capacityMax: 20,
      });

      expect(newClass).toBeDefined();
      expect(newClass.groupName).toBe("Test Group A");
      expect(newClass.capacityMax).toBe(20);
      expect(newClass.levelId).toBe(testLevelId);
      expect(newClass.slotId).toBe(testSlotId);

      testClassGroupAId = newClass.id;
    });

    it("should get class with correct availability info", async () => {
      const classInfo = await getClassWithAvailability(testClassGroupAId);

      expect(classInfo).toBeDefined();
      expect(classInfo?.enrolledCount).toBe(0);
      expect(classInfo?.availableSpots).toBe(20);
      expect(classInfo?.level.id).toBe(testLevelId);
      expect(classInfo?.slot.id).toBe(testSlotId);
    });
  });

  describe("Dynamic Scaling - Parallel Groups", () => {
    it("should create parallel Group B for same Level/Slot combination", async () => {
      const groupB = await createClass({
        levelId: testLevelId,
        slotId: testSlotId,
        groupName: "Test Group B",
        capacityMax: 25,
      });

      expect(groupB).toBeDefined();
      expect(groupB.groupName).toBe("Test Group B");
      expect(groupB.levelId).toBe(testLevelId);
      expect(groupB.slotId).toBe(testSlotId);
      expect(groupB.id).not.toBe(testClassGroupAId);

      testClassGroupBId = groupB.id;
    });

    it("should inherit slot timings from parent slot", async () => {
      const classA = await db.query.classes.findFirst({
        where: eq(classes.id, testClassGroupAId),
        with: {
          slot: true,
        },
      });

      const classB = await db.query.classes.findFirst({
        where: eq(classes.id, testClassGroupBId),
        with: {
          slot: true,
        },
      });

      expect(classA?.slot.startTime).toBeDefined();
      expect(classB?.slot.startTime).toBeDefined();
      expect(classA?.slot.startTime).toBe(classB?.slot.startTime);
      expect(classA?.slot.endTime).toBe(classB?.slot.endTime);
      expect(classA?.slot.day).toBe(classB?.slot.day);
      expect(classA?.slot.period).toBe(classB?.slot.period);
    });

    it("should maintain independent enrollment counts for parallel groups", async () => {
      const student1 = await createStudent({
        firstName: "Student",
        lastName: "GroupA",
        birthDate: "2010-01-15",
        gender: "MALE",
      });

      const student2 = await createStudent({
        firstName: "Student",
        lastName: "GroupB",
        birthDate: "2010-02-20",
        gender: "FEMALE",
      });

      // Enroll in Group A
      const enrollmentA = await createEnrollment({
        studentId: student1.id,
        classId: testClassGroupAId,
        academicYear: 2025,
        type: "NEW",
      });

      await createPayment({
        enrollmentId: enrollmentA.enrollment!.id,
        amount: "500",
        method: "CASH",
        period: "REGISTRATION",
      });
      await validateEnrollment(enrollmentA.enrollment!.id);

      // Enroll in Group B
      const enrollmentB = await createEnrollment({
        studentId: student2.id,
        classId: testClassGroupBId,
        academicYear: 2025,
        type: "NEW",
      });

      await createPayment({
        enrollmentId: enrollmentB.enrollment!.id,
        amount: "500",
        method: "CASH",
        period: "REGISTRATION",
      });
      await validateEnrollment(enrollmentB.enrollment!.id);

      // Check counts
      const classAInfo = await getClassWithAvailability(testClassGroupAId);
      const classBInfo = await getClassWithAvailability(testClassGroupBId);

      expect(classAInfo?.enrolledCount).toBe(1);
      expect(classBInfo?.enrolledCount).toBe(1);
      expect(classAInfo?.availableSpots).toBe(19);
      expect(classBInfo?.availableSpots).toBe(24);

      // Cleanup
      await db.delete(enrollments).where(eq(enrollments.studentId, student1.id));
      await db.delete(enrollments).where(eq(enrollments.studentId, student2.id));
      await db.delete(students).where(eq(students.id, student1.id));
      await db.delete(students).where(eq(students.id, student2.id));
    });
  });

  describe("Capacity Checks", () => {
    it("should find available classes for level and slot", async () => {
      const availableClasses = await findAvailableClasses(
        testLevelId,
        testSlotId
      );

      expect(availableClasses.length).toBeGreaterThan(0);
      const foundClasses = availableClasses.filter(
        (c) => c.id === testClassGroupAId || c.id === testClassGroupBId
      );
      expect(foundClasses.length).toBe(2);
    });

    it("should check class capacity correctly", async () => {
      const hasCapacityA = await checkClassCapacity(testClassGroupAId);
      const hasCapacityB = await checkClassCapacity(testClassGroupBId);

      expect(hasCapacityA).toBe(true);
      expect(hasCapacityB).toBe(true);
    });

    it("should return false when class is at full capacity", async () => {
      // Create a tiny class
      const tinyClass = await createClass({
        levelId: testLevelId,
        slotId: testSlotId,
        groupName: "Tiny Group",
        capacityMax: 1,
      });

      const student = await createStudent({
        firstName: "Solo",
        lastName: "Student",
        birthDate: "2010-03-15",
        gender: "MALE",
      });

      const enrollment = await createEnrollment({
        studentId: student.id,
        classId: tinyClass.id,
        academicYear: 2025,
        type: "NEW",
      });

      await createPayment({
        enrollmentId: enrollment.enrollment!.id,
        amount: "500",
        method: "CASH",
        period: "REGISTRATION",
      });
      await validateEnrollment(enrollment.enrollment!.id);

      const hasCapacity = await checkClassCapacity(tinyClass.id);
      expect(hasCapacity).toBe(false);

      // Cleanup
      await db.delete(enrollments).where(eq(enrollments.studentId, student.id));
      await db.delete(students).where(eq(students.id, student.id));
      await db.delete(classes).where(eq(classes.id, tinyClass.id));
    });
  });
});

