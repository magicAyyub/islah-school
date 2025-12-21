import { select, text, confirm, spinner } from "@clack/prompts";
import {
  createPayment,
  markPaymentAsBounced,
  getEnrollmentBalance,
  getAllPayments,
  getPaymentsByStatus,
} from "../../services/payment.service";

export async function handlePaymentManagement() {
  const action = await select({
    message: "Payment Management:",
    options: [
      { value: "list", label: "List All Payments" },
      { value: "bounced", label: "List Bounced Payments" },
      { value: "create", label: "Create Payment" },
      { value: "bounce", label: "Test Bounced Check (Block Student)" },
      { value: "balance", label: "Check Enrollment Balance" },
    ],
  });

  switch (action) {
    case "list":
      await listAllPayments();
      break;
    case "bounced":
      await listBouncedPayments();
      break;
    case "create":
      await createNewPayment();
      break;
    case "bounce":
      await testBouncedCheck();
      break;
    case "balance":
      await checkEnrollmentBalance();
      break;
  }
}

async function listAllPayments() {
  const s = spinner();
  s.start("Loading payments...");

  const payments = await getAllPayments();
  s.stop();

  console.log("\nAll Payments:");
  console.log("─".repeat(100));
  payments.forEach((p) => {
    const statusIcon = p.status === "COMPLETED" ? "[COMPLETED]" : p.status === "BOUNCED" ? "[BOUNCED]" : "[PENDING]";
    console.log(
      `${statusIcon} ${p.enrollment.student.firstName} ${p.enrollment.student.lastName} | ${p.amount} DH | ${p.method} | ${p.period} | ${p.status}`
    );
    console.log(`   ID: ${p.id} | Date: ${p.paymentDate}`);
  });
  console.log("─".repeat(100));
}

async function listBouncedPayments() {
  const s = spinner();
  s.start("Loading bounced payments...");

  const bouncedPayments = await getPaymentsByStatus("BOUNCED");
  s.stop();

  console.log("\nBounced Payments:");
  console.log("─".repeat(100));
  if (bouncedPayments.length === 0) {
    console.log("No bounced payments found.");
  } else {
    bouncedPayments.forEach((p) => {
      console.log(
        `[BOUNCED] ${p.enrollment.student.firstName} ${p.enrollment.student.lastName} | ${p.amount} DH | ${p.method} | ${p.period}`
      );
      console.log(`   Payment ID: ${p.id} | Date: ${p.paymentDate}`);
      console.log(`   Student Status: ${p.enrollment.student.folderStatus}`);
    });
  }
  console.log("─".repeat(100));
}

async function createNewPayment() {
  const enrollmentId = await text({
    message: "Enrollment ID:",
  });

  const amount = await text({
    message: "Amount:",
    placeholder: "500",
  });

  const method = await select({
    message: "Payment Method:",
    options: [
      { value: "CASH", label: "Cash" },
      { value: "CHECK", label: "Check" },
      { value: "CARD", label: "Card" },
    ],
  });

  const period = await select({
    message: "Payment Period:",
    options: [
      { value: "REGISTRATION", label: "Registration" },
      { value: "Q1", label: "Q1" },
      { value: "Q2", label: "Q2" },
      { value: "Q3", label: "Q3" },
    ],
  });

  const s = spinner();
  s.start("Processing payment...");

  const payment = await createPayment({
    enrollmentId: enrollmentId as string,
    amount: amount as string,
    method: method as "CASH" | "CHECK" | "CARD",
    period: period as "REGISTRATION" | "Q1" | "Q2" | "Q3",
  });

  s.stop(`Payment created: ${payment.amount} (${payment.method})`);
}

async function testBouncedCheck() {
  const paymentId = await text({
    message: "Payment ID to mark as BOUNCED:",
  });

  const confirm_ = await confirm({
    message: "This will BLOCK the student. Continue?",
  });

  if (!confirm_) return;

  const s = spinner();
  s.start("Marking payment as bounced...");

  const result = await markPaymentAsBounced(paymentId as string);

  if (result.success) {
    s.stop(`CRITICAL: ${result.message}`);
  }
}

async function checkEnrollmentBalance() {
  const enrollmentId = await text({
    message: "Enrollment ID:",
  });

  const balance = await getEnrollmentBalance(enrollmentId as string, 2000);

  console.log("\nPayment Balance:");
  console.log(`   Total Paid: ${balance.totalPaid} DH`);
  console.log(`   Expected: ${balance.expectedTotal} DH`);
  console.log(`   Balance: ${balance.balance} DH`);
  console.log("\n   By Period:");
  Object.entries(balance.paymentsByPeriod).forEach(([period, data]) => {
    console.log(`   ${period}: ${data.amount} DH (${data.status})`);
  });
}
