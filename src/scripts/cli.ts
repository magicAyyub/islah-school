import "dotenv/config";
import { intro, outro, select, isCancel } from "@clack/prompts";
import { handleClassManagement } from "./handlers/class.handler";
import { handleStudentManagement } from "./handlers/student.handler";
import { handleEnrollmentManagement } from "./handlers/enrollment.handler";
import { handlePaymentManagement } from "./handlers/payment.handler";
import { handleLists } from "./handlers/list.handler";

async function main() {
  console.clear();
  intro("Islah School Management CLI");

  let running = true;

  while (running) {
    const action = await select({
      message: "What would you like to do?",
      options: [
        { value: "class", label: "Class Management (Capacity, Groups)" },
        { value: "student", label: "Student & Guardian Management (CRM)" },
        { value: "enrollment", label: "Enrollment Management (Validation Flow)" },
        { value: "payment", label: "Payment Management (Bounced Check Test)" },
        { value: "lists", label: "View Lists (Classes, Students, Enrollments)" },
        { value: "exit", label: "Exit" },
      ],
    });

    if (isCancel(action)) {
      running = false;
      break;
    }

    if (action === "exit") {
      running = false;
      break;
    }

    switch (action) {
      case "class":
        await handleClassManagement();
        break;
      case "student":
        await handleStudentManagement();
        break;
      case "enrollment":
        await handleEnrollmentManagement();
        break;
      case "payment":
        await handlePaymentManagement();
        break;
      case "lists":
        await handleLists();
        break;
    }

    console.log("\n");
  }

  outro("Goodbye!");
  process.exit(0);
}

main().catch(console.error);


