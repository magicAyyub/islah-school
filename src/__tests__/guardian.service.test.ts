import { describe, it, expect, afterAll } from "vitest";
import {
  createStudent,
  createGuardian,
  linkGuardianToStudent,
  checkDuplicateStudent,
  getStudentWithGuardians,
  getGuardianWithStudents,
} from "../services/guardian.service";
import { db } from "../db/index";
import { students, guardians, familyLinks } from "../db/schema";
import { eq } from "drizzle-orm";

describe("Guardian & Family Service - CRM Logic", () => {
  let testGuardianId: string;
  let testStudent1Id: string;
  let testStudent2Id: string;

  afterAll(async () => {
    // Cleanup
    await db.delete(familyLinks).where(eq(familyLinks.guardianId, testGuardianId));
    await db.delete(students).where(eq(students.id, testStudent1Id));
    await db.delete(students).where(eq(students.id, testStudent2Id));
    await db.delete(guardians).where(eq(guardians.id, testGuardianId));
  });

  describe("Guardian Management", () => {
    it("should create guardian with required information", async () => {
      const guardian = await createGuardian({
        type: "FATHER",
        firstName: "Mohammed",
        lastName: "TestFamily",
        mobilePhone: "+212698765432",
        email: "mohammed.test@example.com",
        address: "123 Rue Test",
        city: "Casablanca",
      });

      expect(guardian).toBeDefined();
      expect(guardian.type).toBe("FATHER");
      expect(guardian.firstName).toBe("Mohammed");
      expect(guardian.mobilePhone).toBe("+212698765432");

      testGuardianId = guardian.id;
    });
  });

  describe("Student Creation & Duplicate Prevention", () => {
    it("should create student successfully", async () => {
      const student = await createStudent({
        firstName: "Aya",
        lastName: "TestFamily",
        birthDate: "2011-05-20",
        gender: "FEMALE",
      });

      expect(student).toBeDefined();
      expect(student.firstName).toBe("Aya");
      expect(student.folderStatus).toBe("ACTIVE");

      testStudent1Id = student.id;
    });

    it("should detect duplicate students by name and birthdate", async () => {
      const duplicates = await checkDuplicateStudent(
        "Aya",
        "TestFamily",
        "2011-05-20"
      );

      expect(duplicates.length).toBeGreaterThan(0);
      expect(duplicates[0].firstName).toBe("Aya");
      expect(duplicates[0].lastName.toLowerCase()).toBe("testfamily");
      expect(duplicates[0].birthDate).toBe("2011-05-20");
    });

    it("should not find duplicates for different students", async () => {
      const duplicates = await checkDuplicateStudent(
        "NonExistent",
        "Student",
        "2000-01-01"
      );

      expect(duplicates.length).toBe(0);
    });
  });

  describe("Sibling Linkage", () => {
    it("should link student to existing guardian without creating duplicate", async () => {
      const link = await linkGuardianToStudent(testGuardianId, testStudent1Id);

      expect(link).toBeDefined();
      expect(link.guardianId).toBe(testGuardianId);
      expect(link.studentId).toBe(testStudent1Id);

      // Verify guardian wasn't duplicated
      const allGuardians = await db
        .select()
        .from(guardians)
        .where(eq(guardians.mobilePhone, "+212698765432"));

      expect(allGuardians.length).toBe(1);
    });

    it("should link multiple siblings to same guardian", async () => {
      const student2 = await createStudent({
        firstName: "Hamza",
        lastName: "TestFamily",
        birthDate: "2013-08-15",
        gender: "MALE",
      });

      testStudent2Id = student2.id;

      await linkGuardianToStudent(testGuardianId, testStudent2Id);

      const guardian = await getGuardianWithStudents(testGuardianId);

      expect(guardian?.familyLinks.length).toBe(2);
      expect(guardian?.familyLinks.map((l) => l.studentId)).toContain(testStudent1Id);
      expect(guardian?.familyLinks.map((l) => l.studentId)).toContain(testStudent2Id);
    });
  });

  describe("Family Integrity & Retrieval", () => {
    it("should retrieve full family tree from student perspective", async () => {
      const student = await getStudentWithGuardians(testStudent1Id);

      expect(student).toBeDefined();
      expect(student?.familyLinks.length).toBeGreaterThan(0);
      expect(student?.familyLinks[0].guardian.id).toBe(testGuardianId);
      expect(student?.familyLinks[0].guardian.firstName).toBe("Mohammed");
    });

    it("should retrieve full family tree from guardian perspective", async () => {
      const guardian = await getGuardianWithStudents(testGuardianId);

      expect(guardian).toBeDefined();
      expect(guardian?.familyLinks.length).toBe(2);

      const studentNames = guardian?.familyLinks.map(
        (l) => l.student.firstName
      );
      expect(studentNames).toContain("Aya");
      expect(studentNames).toContain("Hamza");
    });

    it("should maintain relationship integrity across queries", async () => {
      const guardian = await getGuardianWithStudents(testGuardianId);
      const student1 = await getStudentWithGuardians(testStudent1Id);
      const student2 = await getStudentWithGuardians(testStudent2Id);

      expect(guardian?.familyLinks.length).toBe(2);
      expect(student1?.familyLinks.length).toBe(1);
      expect(student2?.familyLinks.length).toBe(1);

      expect(student1?.familyLinks[0].guardianId).toBe(testGuardianId);
      expect(student2?.familyLinks[0].guardianId).toBe(testGuardianId);
    });
  });

  describe("Contact Information Management", () => {
    it("should allow multiple guardians for one student", async () => {
      const mother = await createGuardian({
        type: "MOTHER",
        firstName: "Fatima",
        lastName: "TestFamily",
        mobilePhone: "+212687654321",
      });

      await linkGuardianToStudent(mother.id, testStudent1Id);

      const student = await getStudentWithGuardians(testStudent1Id);

      expect(student?.familyLinks.length).toBe(2);

      const guardianTypes = student?.familyLinks.map((l) => l.guardian.type);
      expect(guardianTypes).toContain("FATHER");
      expect(guardianTypes).toContain("MOTHER");

      // Cleanup
      await db.delete(familyLinks).where(eq(familyLinks.guardianId, mother.id));
      await db.delete(guardians).where(eq(guardians.id, mother.id));
    });

    it("should support tutor as guardian type", async () => {
      const student3 = await createStudent({
        firstName: "Orphan",
        lastName: "Student",
        birthDate: "2010-12-10",
        gender: "MALE",
      });

      const tutor = await createGuardian({
        type: "TUTOR",
        firstName: "Uncle",
        lastName: "Guardian",
        mobilePhone: "+212676543210",
      });

      await linkGuardianToStudent(tutor.id, student3.id);

      const studentWithTutor = await getStudentWithGuardians(student3.id);

      expect(studentWithTutor?.familyLinks[0].guardian.type).toBe("TUTOR");

      // Cleanup
      await db.delete(familyLinks).where(eq(familyLinks.guardianId, tutor.id));
      await db.delete(students).where(eq(students.id, student3.id));
      await db.delete(guardians).where(eq(guardians.id, tutor.id));
    });
  });
});
