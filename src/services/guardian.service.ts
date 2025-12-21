import "dotenv/config";
import { db } from "../db/index";
import { guardians, students, familyLinks } from "../db/schema";
import { eq } from "drizzle-orm";

interface CreateGuardianParams {
  type: "FATHER" | "MOTHER" | "TUTOR";
  firstName: string;
  lastName: string;
  email?: string;
  mobilePhone: string;
  fixedPhone?: string;
  address?: string;
  city?: string;
}

interface CreateStudentParams {
  firstName: string;
  lastName: string;
  birthDate: string;
  birthPlace?: string;
  gender: "MALE" | "FEMALE";
  photoUrl?: string;
}

export async function createGuardian(params: CreateGuardianParams) {
  const [guardian] = await db.insert(guardians).values(params).returning();
  return guardian;
}

export async function createStudent(params: CreateStudentParams) {
  const [student] = await db.insert(students).values(params).returning();
  return student;
}

export async function linkGuardianToStudent(
  guardianId: string,
  studentId: string,
  relationship: string = "Parent of"
) {
  const [link] = await db
    .insert(familyLinks)
    .values({ guardianId, studentId, relationship })
    .returning();
  return link;
}

export async function checkDuplicateStudent(
  firstName: string,
  lastName: string,
  birthDate: string
) {
  const existing = await db
    .select()
    .from(students)
    .where(eq(students.firstName, firstName))
    .limit(10);

  return existing.filter(
    (s) =>
      s.lastName.toLowerCase() === lastName.toLowerCase() &&
      s.birthDate === birthDate
  );
}

export async function getStudentWithGuardians(studentId: string) {
  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
    with: {
      familyLinks: {
        with: {
          guardian: true,
        },
      },
    },
  });

  return student;
}

export async function getGuardianWithStudents(guardianId: string) {
  const guardian = await db.query.guardians.findFirst({
    where: eq(guardians.id, guardianId),
    with: {
      familyLinks: {
        with: {
          student: true,
        },
      },
    },
  });

  return guardian;
}

export async function getAllStudents() {
  return await db.query.students.findMany({
    with: {
      familyLinks: {
        with: {
          guardian: true,
        },
      },
    },
  });
}

export async function getAllGuardians() {
  return await db.query.guardians.findMany({
    with: {
      familyLinks: {
        with: {
          student: true,
        },
      },
    },
  });
}

export async function findGuardianByPhone(mobilePhone: string) {
  const guardian = await db.query.guardians.findFirst({
    where: eq(guardians.mobilePhone, mobilePhone),
    with: {
      familyLinks: {
        with: {
          student: true,
        },
      },
    },
  });

  return guardian;
}
