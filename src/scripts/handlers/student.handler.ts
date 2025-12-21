import { select, text, confirm, spinner } from "@clack/prompts";
import {
  createStudent,
  createGuardian,
  linkGuardianToStudent,
  checkDuplicateStudent,
  getStudentWithGuardians,
  getAllStudents,
  getAllGuardians,
  findGuardianByPhone,
} from "../../services/guardian.service";

export async function handleStudentManagement() {
  const action = await select({
    message: "Student Management:",
    options: [
      { value: "list", label: "List All Students" },
      { value: "listGuardians", label: "List All Guardians" },
      { value: "create", label: "Create Student + Guardian (with duplicate check)" },
      { value: "view", label: "View Student with Guardians" },
    ],
  });

  switch (action) {
    case "list":
      await listStudents();
      break;
    case "listGuardians":
      await listGuardians();
      break;
    case "create":
      await createStudentWithGuardian();
      break;
    case "view":
      await viewStudentWithGuardians();
      break;
  }
}

async function listStudents() {
  const s = spinner();
  s.start("Loading students...");

  const students = await getAllStudents();
  s.stop();

  console.log("\nAll Students:");
  console.log("─".repeat(100));
  students.forEach((student) => {
    const guardianCount = student.familyLinks.length;
    const statusIcon = student.folderStatus === "ACTIVE" ? "[ACTIVE]" : "[BLOCKED]";
    console.log(
      `${statusIcon} ${student.firstName} ${student.lastName} | Birth: ${student.birthDate} | ${student.gender} | ${guardianCount} guardian(s)`
    );
    console.log(`   ID: ${student.id}`);
  });
  console.log("─".repeat(100));
}

async function listGuardians() {
  const s = spinner();
  s.start("Loading guardians...");

  const guardians = await getAllGuardians();
  s.stop();

  console.log("\nAll Guardians:");
  console.log("─".repeat(100));
  guardians.forEach((guardian) => {
    const studentCount = guardian.familyLinks.length;
    console.log(
      `${guardian.type} | ${guardian.firstName} ${guardian.lastName} | ${guardian.mobilePhone} | ${studentCount} student(s)`
    );
    console.log(`   ID: ${guardian.id}`);
  });
  console.log("─".repeat(100));
}

async function createStudentWithGuardian() {
  const firstName = await text({
    message: "Student First Name:",
    placeholder: "Ahmed",
  });

  const lastName = await text({
    message: "Student Last Name:",
    placeholder: "Ben Ali",
  });

  const birthDate = await text({
    message: "Birth Date (YYYY-MM-DD):",
    placeholder: "2010-05-15",
  });

  const duplicates = await checkDuplicateStudent(
    firstName as string,
    lastName as string,
    birthDate as string
  );

  if (duplicates.length > 0) {
    console.log("\nWarning: Potential duplicate student(s) found:");
    duplicates.forEach((d) => {
      console.log(`   ${d.firstName} ${d.lastName} - ${d.birthDate}`);
    });

    const proceed = await confirm({
      message: "Do you want to create anyway?",
    });

    if (!proceed) return;
  }

  const gender = await select({
    message: "Gender:",
    options: [
      { value: "MALE", label: "Male" },
      { value: "FEMALE", label: "Female" },
    ],
  });

  const s = spinner();
  s.start("Creating student...");

  const student = await createStudent({
    firstName: firstName as string,
    lastName: lastName as string,
    birthDate: birthDate as string,
    gender: gender as "MALE" | "FEMALE",
  });

  s.stop(`Student created: ${student.firstName} ${student.lastName}`);

  const addGuardian = await confirm({
    message: "Add Guardian?",
  });

  if (addGuardian) {
    const guardianPhone = await text({
      message: "Mobile Phone:",
      placeholder: "+212600000000",
    });

    const existingGuardian = await findGuardianByPhone(guardianPhone as string);

    if (existingGuardian) {
      console.log(
        `\\nFound existing guardian: ${existingGuardian.firstName} ${existingGuardian.lastName}`
      );
      console.log(`   Type: ${existingGuardian.type}`);
      console.log(`   Students: ${existingGuardian.familyLinks.length}`);

      const useExisting = await confirm({
        message: "Link to this existing guardian?",
      });

      if (useExisting) {
        await linkGuardianToStudent(existingGuardian.id, student.id);
        console.log(`Guardian linked to student`);
        return;
      }
    }

    const guardianFirstName = await text({
      message: "Guardian First Name:",
    });

    const guardianLastName = await text({
      message: "Guardian Last Name:",
    });

    const guardianType = await select({
      message: "Guardian Type:",
      options: [
        { value: "FATHER", label: "Father" },
        { value: "MOTHER", label: "Mother" },
        { value: "TUTOR", label: "Tutor" },
      ],
    });

    const guardian = await createGuardian({
      type: guardianType as "FATHER" | "MOTHER" | "TUTOR",
      firstName: guardianFirstName as string,
      lastName: guardianLastName as string,
      mobilePhone: guardianPhone as string,
    });

    await linkGuardianToStudent(guardian.id, student.id);

    console.log(`Guardian linked to student`);
  }
}

async function viewStudentWithGuardians() {
  const studentId = await text({
    message: "Enter Student ID:",
  });

  const student = await getStudentWithGuardians(studentId as string);
  if (student) {
    console.log(`\nStudent: ${student.firstName} ${student.lastName}`);
    console.log(`   Birth Date: ${student.birthDate}`);
    console.log(`   Folder Status: ${student.folderStatus}`);
    console.log("\n   Guardians:");
    student.familyLinks.forEach((link) => {
      console.log(`   - ${link.guardian.firstName} ${link.guardian.lastName} (${link.guardian.type})`);
    });
  }
}
