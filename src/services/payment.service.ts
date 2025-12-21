import "dotenv/config";
import { db } from "../db/index";
import { payments, students, enrollments } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { generateReceipt } from "./receipt.service";

interface CreatePaymentParams {
  enrollmentId: string;
  amount: string;
  method: "CASH" | "CHECK" | "CARD";
  period: "REGISTRATION" | "Q1" | "Q2" | "Q3";
  paymentDate?: string;
}

interface PaymentBalance {
  enrollmentId: string;
  totalPaid: number;
  expectedTotal: number;
  balance: number;
  paymentsByPeriod: Record<string, { amount: number; status: string }>;
}

export async function createPayment(params: CreatePaymentParams) {
  const [payment] = await db
    .insert(payments)
    .values({
      ...params,
      status: "COMPLETED",
      paymentDate: params.paymentDate || new Date().toISOString(),
    })
    .returning();

  // Auto-generate receipt for completed payments
  if (payment.status === "COMPLETED") {
    await generateReceipt(payment.id).catch(err => {
      console.error(`Failed to generate receipt for payment ${payment.id}:`, err);
    });
  }

  return payment;
}

export async function markPaymentAsBounced(paymentId: string) {
  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
    with: {
      enrollment: {
        with: {
          student: true,
        },
      },
    },
  });

  if (!payment) {
    return { success: false, message: "Payment not found" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: "BOUNCED" })
      .where(eq(payments.id, paymentId));

    await tx
      .update(students)
      .set({ folderStatus: "BLOCKED" })
      .where(eq(students.id, payment.enrollment.studentId));
  });

  return {
    success: true,
    message: `Payment marked as BOUNCED. Student ${payment.enrollment.student.firstName} ${payment.enrollment.student.lastName} folder is now BLOCKED`,
    studentId: payment.enrollment.studentId,
    studentName: `${payment.enrollment.student.firstName} ${payment.enrollment.student.lastName}`,
  };
}

export async function getEnrollmentBalance(
  enrollmentId: string,
  expectedTotal: number = 2000
): Promise<PaymentBalance> {
  const paymentsList = await db.query.payments.findMany({
    where: eq(payments.enrollmentId, enrollmentId),
  });

  const totalPaid = paymentsList
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const paymentsByPeriod = paymentsList.reduce(
    (acc, p) => {
      acc[p.period] = {
        amount: parseFloat(p.amount),
        status: p.status,
      };
      return acc;
    },
    {} as Record<string, { amount: number; status: string }>
  );

  return {
    enrollmentId,
    totalPaid,
    expectedTotal,
    balance: expectedTotal - totalPaid,
    paymentsByPeriod,
  };
}

export async function getFamilyBalance(guardianId: string) {
  const result = await db
    .select({
      studentId: students.id,
      studentName: sql<string>`${students.firstName} || ' ' || ${students.lastName}`,
      enrollmentId: enrollments.id,
      totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${payments.status} = 'COMPLETED' THEN CAST(${payments.amount} AS NUMERIC) ELSE 0 END), 0)`,
    })
    .from(students)
    .innerJoin(enrollments, eq(enrollments.studentId, students.id))
    .leftJoin(payments, eq(payments.enrollmentId, enrollments.id))
    .where(
      sql`${students.id} IN (
        SELECT student_id FROM family_links WHERE guardian_id = ${guardianId}
      )`
    )
    .groupBy(students.id, enrollments.id);

  return result;
}

export async function getAllPayments(enrollmentId?: string) {
  if (enrollmentId) {
    return await db.query.payments.findMany({
      where: eq(payments.enrollmentId, enrollmentId),
      with: {
        enrollment: {
          with: {
            student: true,
          },
        },
      },
    });
  }

  return await db.query.payments.findMany({
    with: {
      enrollment: {
        with: {
          student: true,
        },
      },
    },
    orderBy: (payments, { desc }) => [desc(payments.paymentDate)],
  });
}

export async function getPaymentsByStatus(status: "COMPLETED" | "PENDING" | "BOUNCED") {
  return await db.query.payments.findMany({
    where: eq(payments.status, status),
    with: {
      enrollment: {
        with: {
          student: true,
        },
      },
    },
  });
}

export async function getUnpaidStudents(academicYear: number, expectedTotal: number = 2000) {
  const allEnrollments = await db.query.enrollments.findMany({
    where: eq(enrollments.academicYear, academicYear),
    with: {
      student: true,
      class: {
        with: {
          level: true,
        },
      },
      payments: true,
    },
  });

  const unpaidList = allEnrollments
    .filter((enrollment) => enrollment.status === "VALIDATED")
    .map((enrollment) => {
      const totalPaid = enrollment.payments
        .filter((p) => p.status === "COMPLETED")
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      const balance = expectedTotal - totalPaid;
      const paymentCount = enrollment.payments.filter((p) => p.status === "COMPLETED").length;
      const hasPendingPayments = enrollment.payments.some((p) => p.status === "PENDING");
      const hasBouncedPayments = enrollment.payments.some((p) => p.status === "BOUNCED");

      return {
        enrollmentId: enrollment.id,
        studentId: enrollment.student.id,
        studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        level: enrollment.class.level.label,
        groupName: enrollment.class.groupName,
        folderStatus: enrollment.student.folderStatus,
        totalPaid,
        balance,
        paymentCount,
        hasPendingPayments,
        hasBouncedPayments,
      };
    })
    .filter((record) => record.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  return {
    academicYear,
    totalUnpaid: unpaidList.length,
    totalDebt: unpaidList.reduce((sum, r) => sum + r.balance, 0),
    students: unpaidList,
  };
}
