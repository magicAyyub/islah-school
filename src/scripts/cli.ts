import "dotenv/config";
import { intro, outro, select } from "@clack/prompts";
import { handleClassManagement } from "./handlers/class.handler";
import { handleStudentManagement } from "./handlers/student.handler";
import { handleEnrollmentManagement } from "./handlers/enrollment.handler";
import { handlePaymentManagement } from "./handlers/payment.handler";
import { handleLists } from "./handlers/list.handler";

async function main() {
  console.clear();
  intro("🎓 École Islah - School Management CLI");

  const action = await select({
    message: "What would you like to do?",
    options: [
      { value: "class", label: "📚 Class Management (Capacity, Groups)" },
      { value: "student", label: "👨‍🎓 Student & Guardian Management (CRM)" },
      { value: "enrollment", label: "📝 Enrollment Management (Validation Flow)" },
      { value: "payment", label: "💰 Payment Management (Bounced Check Test)" },
      { value: "lists", label: "📋 View Lists (Classes, Students, Enrollments)" },
      { value: "exit", label: "❌ Exit" },
    ],
  });

  if (action === "exit") {
    outro("👋 Goodbye!");
    process.exit(0);
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

  outro("✨ Done!");
  process.exit(0);
}

main().catch(console.error);


