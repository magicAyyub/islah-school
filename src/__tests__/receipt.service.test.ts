import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db/index";
import { guardians, students, levels, slots, classes, enrollments, payments } from "../db/schema";
import { eq, InferSelectModel } from "drizzle-orm";
import { createPayment } from "../services/payment.service";
import { generateReceipt, reprintReceipt, getReceiptPath, listEnrollmentReceipts } from "../services/receipt.service";
import fs from "fs";
import path from "path";

type Guardian = InferSelectModel<typeof guardians>;
type Student = InferSelectModel<typeof students>;
type Level = InferSelectModel<typeof levels>;
type Slot = InferSelectModel<typeof slots>;
type Class = InferSelectModel<typeof classes>;
type Enrollment = InferSelectModel<typeof enrollments>;
type Payment = InferSelectModel<typeof payments>;

describe("Receipt Service", () => {
  let testGuardian: Guardian;
  let testStudent: Student;
  let testLevel: Level;
  let testSlot: Slot;
  let testClass: Class;
  let testEnrollment: Enrollment;
  let testPayment: Payment;

  beforeAll(async () => {
    // Setup test data
    [testGuardian] = await db
      .insert(guardians)
      .values({
        type: "FATHER",
        firstName: "Receipt",
        lastName: "Test",
        mobilePhone: "+212600999999",
      })
      .returning();

    [testStudent] = await db
      .insert(students)
      .values({
        firstName: "Receipt",
        lastName: "Student",
        birthDate: "2015-01-01",
        gender: "MALE",
        folderStatus: "ACTIVE",
      })
      .returning();

    [testLevel] = await db.select().from(levels).limit(1);
    [testSlot] = await db.select().from(slots).limit(1);

    [testClass] = await db
      .insert(classes)
      .values({
        levelId: testLevel.id,
        slotId: testSlot.id,
        groupName: "Receipt Test Group",
        capacityMax: 10,
      })
      .returning();

    [testEnrollment] = await db
      .insert(enrollments)
      .values({
        studentId: testStudent.id,
        classId: testClass.id,
        academicYear: 2025,
        type: "NEW",
        status: "PENDING",
      })
      .returning();

    testPayment = await createPayment({
      enrollmentId: testEnrollment.id,
      amount: "500",
      method: "CASH",
      period: "REGISTRATION",
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testPayment) await db.delete(payments).where(eq(payments.id, testPayment.id));
    if (testEnrollment) await db.delete(enrollments).where(eq(enrollments.id, testEnrollment.id));
    if (testClass) await db.delete(classes).where(eq(classes.id, testClass.id));
    if (testStudent) await db.delete(students).where(eq(students.id, testStudent.id));
    if (testGuardian) await db.delete(guardians).where(eq(guardians.id, testGuardian.id));

    // Cleanup test receipts
    const receiptsDir = path.join(process.cwd(), "receipts");
    if (fs.existsSync(receiptsDir)) {
      const files = fs.readdirSync(receiptsDir);
      files
        .filter(f => f.startsWith(`receipt_${testPayment.id}`))
        .forEach(f => fs.unlinkSync(path.join(receiptsDir, f)));
    }
  });

  describe("generateReceipt", () => {
    it("should generate a PDF receipt for a payment", async () => {
      const result = await generateReceipt(testPayment.id);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Receipt generated");
      expect(result.filePath).toBeDefined();

      // Verify file exists
      if (result.filePath) {
        expect(fs.existsSync(result.filePath)).toBe(true);

        // Verify it's a PDF (magic bytes)
        const buffer = fs.readFileSync(result.filePath);
        expect(buffer.toString("utf-8", 0, 4)).toBe("%PDF");
      }
    });

    it("should return error for non-existent payment", async () => {
      // Use a valid UUID format that doesn't exist
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const result = await generateReceipt(fakeId);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Payment not found");
      expect(result.filePath).toBeUndefined();
    });

    it("should create PDF file with proper structure", async () => {
      const result = await generateReceipt(testPayment.id);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();

      if (result.filePath) {
        // Verify file exists and has content
        const stats = fs.statSync(result.filePath);
        expect(stats.size).toBeGreaterThan(1000); // PDFs should be > 1KB
      }
    });
  });

  describe("reprintReceipt", () => {
    it("should reprint an existing receipt", async () => {
      const firstResult = await generateReceipt(testPayment.id);
      expect(firstResult.success).toBe(true);

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 100));

      const reprintResult = await reprintReceipt(testPayment.id);
      expect(reprintResult.success).toBe(true);
      expect(reprintResult.filePath).toBeDefined();
      expect(reprintResult.filePath).not.toBe(firstResult.filePath);

      // Both files should exist
      if (firstResult.filePath && reprintResult.filePath) {
        expect(fs.existsSync(firstResult.filePath)).toBe(true);
        expect(fs.existsSync(reprintResult.filePath)).toBe(true);
      }
    });
  });

  describe("getReceiptPath", () => {
    it("should return the most recent receipt path", async () => {
      await generateReceipt(testPayment.id);
      await new Promise(resolve => setTimeout(resolve, 100));
      await generateReceipt(testPayment.id);

      const receiptPath = await getReceiptPath(testPayment.id);

      expect(receiptPath).toBeDefined();
      expect(receiptPath).toContain(`receipt_${testPayment.id}`);
      
      if (receiptPath) {
        expect(fs.existsSync(receiptPath)).toBe(true);
      }
    });

    it("should return null if no receipt exists", async () => {
      const receiptPath = await getReceiptPath("non-existent-payment-id");
      expect(receiptPath).toBeNull();
    });
  });

  describe("listEnrollmentReceipts", () => {
    it("should list all receipts for an enrollment", async () => {
      // Generate multiple receipts (from the same payment)
      await generateReceipt(testPayment.id);
      await new Promise(resolve => setTimeout(resolve, 100));
      await generateReceipt(testPayment.id);

      const receipts = await listEnrollmentReceipts(testEnrollment.id);

      expect(receipts.length).toBeGreaterThanOrEqual(2);
      receipts.forEach(receipt => {
        expect(fs.existsSync(receipt)).toBe(true);
      });
    });

    it("should return empty array if no receipts exist", async () => {
      const [newEnrollment] = await db
        .insert(enrollments)
        .values({
          studentId: testStudent.id,
          classId: testClass.id,
          academicYear: 2026,
          type: "NEW",
          status: "PENDING",
        })
        .returning();

      const receipts = await listEnrollmentReceipts(newEnrollment.id);

      expect(receipts).toEqual([]);

      // Cleanup
      await db.delete(enrollments).where(eq(enrollments.id, newEnrollment.id));
    });
  });

  describe("Receipt auto-generation on payment creation", () => {
    it("should auto-generate receipt when payment is created", async () => {
      const newPayment = await createPayment({
        enrollmentId: testEnrollment.id,
        amount: "300",
        method: "CHECK",
        period: "Q1",
      });

      // Wait a bit for async receipt generation
      await new Promise(resolve => setTimeout(resolve, 500));

      const receiptPath = await getReceiptPath(newPayment.id);

      expect(receiptPath).toBeDefined();
      if (receiptPath) {
        expect(fs.existsSync(receiptPath)).toBe(true);
      }

      // Cleanup
      await db.delete(payments).where(eq(payments.id, newPayment.id));
      
      if (receiptPath) {
        fs.unlinkSync(receiptPath);
      }
    });
  });
});
