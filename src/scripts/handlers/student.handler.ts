import { select, text, confirm, spinner, isCancel } from "@clack/prompts";
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
      { value: "back", label: "Back" },
    ],
  });

  if (isCancel(action) || action === "back") return;

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

  if (students.length === 0) {
    console.log("\nNo students found.");
    return;
  }

  console.log("\nAll Students:");
  const tableData = students.map((student) => ({
    Status: student.folderStatus,
    "First Name": student.firstName,
    "Last Name": student.lastName,
    "Birth Date": student.birthDate,
    Gender: student.gender,
    Guardians: student.familyLinks.length,
  }));
  console.table(tableData, Object.keys(tableData[0]));
  console.log(`\nTotal: ${students.length} students`);
  console.log("\nStudent IDs:");
  students.forEach((student, i) => {
    console.log(`[${i}] ${student.id} - ${student.firstName} ${student.lastName}`);
  });
}

async function listGuardians() {
  const s = spinner();
  s.start("Loading guardians...");

  const guardians = await getAllGuardians();
  s.stop();

  if (guardians.length === 0) {
    console.log("\nNo guardians found.");
    return;
  }

  console.log("\nAll Guardians:");
  const tableData = guardians.map((guardian) => ({
    Type: guardian.type,
    "First Name": guardian.firstName,
    "Last Name": guardian.lastName,
    Phone: guardian.mobilePhone,
    Students: guardian.familyLinks.length,
  }));
  console.table(tableData, Object.keys(tableData[0]));
  console.log(`\nTotal: ${guardians.length} guardians`);
  console.log("\nGuardian IDs:");
  guardians.forEach((guardian, i) => {
    console.log(`[${i}] ${guardian.id} - ${guardian.firstName} ${guardian.lastName}`);
  });
}

async function createStudentWithGuardian() {
  const firstName = await text({
    message: "Student First Name:",
    placeholder: "Ahmed",
  });

  if (isCancel(firstName)) return;

  const lastName = await text({
    message: "Student Last Name:",
    placeholder: "Ben Ali",
  });

  if (isCancel(lastName)) return;

  const birthDate = await text({
    message: "Birth Date (YYYY-MM-DD):",
    placeholder: "2010-05-15",
  });

  if (isCancel(birthDate)) return;

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

  if (isCancel(gender)) return;

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

  if (isCancel(addGuardian) || !addGuardian) return;

  const guardianPhone = await text({
    message: "Mobile Phone:",
    placeholder: "+212600000000",
  });

  if (isCancel(guardianPhone)) return;

  const existingGuardian = await findGuardianByPhone(guardianPhone as string);

  if (existingGuardian) {
    console.log(
      `\nFound existing guardian: ${existingGuardian.firstName} ${existingGuardian.lastName}`
    );
    console.log(`   Type: ${existingGuardian.type}`);
    console.log(`   Students: ${existingGuardian.familyLinks.length}`);

    const useExisting = await confirm({
      message: "Link to this existing guardian?",
    });

    if (isCancel(useExisting)) return;

    if (useExisting) {
      await linkGuardianToStudent(existingGuardian.id, student.id);
      console.log(`Guardian linked to student`);
      return;
    }
  }

  const guardianFirstName = await text({
    message: "Guardian First Name:",
  });

  if (isCancel(guardianFirstName)) return;

  const guardianLastName = await text({
    message: "Guardian Last Name:",
  });

  if (isCancel(guardianLastName)) return;

  const guardianType = await select({
    message: "Guardian Type:",
    options: [
      { value: "FATHER", label: "Father" },
      { value: "MOTHER", label: "Mother" },
      { value: "TUTOR", label: "Tutor" },
    ],
  });

  if (isCancel(guardianType)) return;

  const guardian = await createGuardian({
    type: guardianType as "FATHER" | "MOTHER" | "TUTOR",
    firstName: guardianFirstName as string,
    lastName: guardianLastName as string,
    mobilePhone: guardianPhone as string,
  });

  await linkGuardianToStudent(guardian.id, student.id);

  console.log(`Guardian linked to student`);
}

async function viewStudentWithGuardians() {
  const studentId = await text({
    message: "Enter Student ID:",
  });

  if (isCancel(studentId)) return;

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
