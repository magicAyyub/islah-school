import "dotenv/config";
import { db } from "../db/index";
import { enrollments, students, payments } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { checkClassCapacity, getClassWithAvailability } from "./class.service";

interface CreateEnrollmentParams {
  studentId: string;
  classId: string;
  academicYear: number;
  type: "NEW" | "RE_ENROLLMENT";
}

interface EnrollmentResult {
  success: boolean;
  enrollment?: typeof enrollments.$inferSelect;
  message: string;
}

export async function createEnrollment(
  params: CreateEnrollmentParams
): Promise<EnrollmentResult> {
  const student = await db.query.students.findFirst({
    where: eq(students.id, params.studentId),
  });

  if (!student) {
    return { success: false, message: "Student not found" };
  }

  if (student.folderStatus === "BLOCKED") {
    return { success: false, message: "Student folder is blocked" };
  }

  const hasCapacity = await checkClassCapacity(params.classId);
  if (!hasCapacity) {
    const classInfo = await getClassWithAvailability(params.classId);
    return {
      success: false,
      message: `Class ${classInfo?.groupName} is full (${classInfo?.capacityMax}/${classInfo?.capacityMax})`,
    };
  }

  const existingEnrollment = await db.query.enrollments.findFirst({
    where: and(
      eq(enrollments.studentId, params.studentId),
      eq(enrollments.academicYear, params.academicYear)
    ),
  });

  if (existingEnrollment) {
    return {
      success: false,
      message: "Student already enrolled for this academic year",
    };
  }

  const [enrollment] = await db
    .insert(enrollments)
    .values({
      ...params,
      status: "PENDING",
    })
    .returning();

  return {
    success: true,
    enrollment,
    message: "Enrollment created with PENDING status",
  };
}

export async function validateEnrollment(enrollmentId: string) {
  const registrationPayment = await db.query.payments.findFirst({
    where: and(
      eq(payments.enrollmentId, enrollmentId),
      eq(payments.period, "REGISTRATION"),
      eq(payments.status, "COMPLETED")
    ),
  });

  if (!registrationPayment) {
    return {
      success: false,
      message: "Cannot validate: Registration payment not completed",
    };
  }

  const [updated] = await db
    .update(enrollments)
    .set({ status: "VALIDATED", validationDate: new Date().toISOString() })
    .where(eq(enrollments.id, enrollmentId))
    .returning();

  return {
    success: true,
    enrollment: updated,
    message: "Enrollment validated",
  };
}

export async function cancelEnrollment(enrollmentId: string) {
  const [updated] = await db
    .update(enrollments)
    .set({ status: "CANCELED" })
    .where(eq(enrollments.id, enrollmentId))
    .returning();

  return updated;
}

export async function getEnrollmentWithDetails(enrollmentId: string) {
  const enrollment = await db.query.enrollments.findFirst({
    where: eq(enrollments.id, enrollmentId),
    with: {
      student: true,
      class: {
        with: {
          level: true,
          slot: true,
        },
      },
      payments: true,
    },
  });

  return enrollment;
}

export async function getAllEnrollments(academicYear?: number) {
  const query = db.query.enrollments.findMany({
    with: {
      student: true,
      class: {
        with: {
          level: true,
          slot: true,
        },
      },
      payments: true,
    },
    orderBy: (enrollments, { desc }) => [desc(enrollments.academicYear)],
  });

  if (academicYear) {
    return await db.query.enrollments.findMany({
      where: eq(enrollments.academicYear, academicYear),
      with: {
        student: true,
        class: {
          with: {
            level: true,
            slot: true,
          },
        },
        payments: true,
      },
      orderBy: (enrollments, { desc }) => [desc(enrollments.academicYear)],
    });
  }

  return await query;
}

export async function getEnrollmentsByStudent(studentId: string) {
  return await db.query.enrollments.findMany({
    where: eq(enrollments.studentId, studentId),
    with: {
      class: {
        with: {
          level: true,
          slot: true,
        },
      },
      payments: true,
    },
  });
}

export async function checkReEnrollmentEligibility(studentId: string, academicYear: number) {
  const previousEnrollments = await db.query.enrollments.findMany({
    where: and(
      eq(enrollments.studentId, studentId),
      eq(enrollments.status, "VALIDATED")
    ),
    orderBy: (enrollments, { desc }) => [desc(enrollments.academicYear)],
  });

  const hasHistory = previousEnrollments.length > 0;
  const lastYear = hasHistory ? previousEnrollments[0].academicYear : null;

  return {
    isReturning: hasHistory,
    isPriority: hasHistory && lastYear === academicYear - 1,
    lastAcademicYear: lastYear,
    totalYears: previousEnrollments.length,
  };
}

export async function createPriorityEnrollment(
  params: CreateEnrollmentParams,
//   priorityDeadline?: string
): Promise<EnrollmentResult> {
  const eligibility = await checkReEnrollmentEligibility(
    params.studentId,
    params.academicYear
  );

  if (eligibility.isPriority) {
    const student = await db.query.students.findFirst({
      where: eq(students.id, params.studentId),
    });

    if (!student) {
      return { success: false, message: "Student not found" };
    }

    if (student.folderStatus === "BLOCKED") {
      return { success: false, message: "Student folder is blocked" };
    }

    const existingEnrollment = await db.query.enrollments.findFirst({
      where: and(
        eq(enrollments.studentId, params.studentId),
        eq(enrollments.academicYear, params.academicYear)
      ),
    });

    if (existingEnrollment) {
      return {
        success: false,
        message: "Student already enrolled for this academic year",
      };
    }

    const [enrollment] = await db
      .insert(enrollments)
      .values({
        ...params,
        status: "PENDING",
        type: "RE_ENROLLMENT",
      })
      .returning();

    return {
      success: true,
      enrollment,
      message: `Priority re-enrollment created (${eligibility.totalYears} years of history)`,
    };
  }

  return createEnrollment(params);
}
