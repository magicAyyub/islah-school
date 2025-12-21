import { select, text, confirm, spinner, isCancel } from "@clack/prompts";
import {
  createPayment,
  markPaymentAsBounced,
  getEnrollmentBalance,
  getAllPayments,
  getPaymentsByStatus,
  getUnpaidStudents,
} from "../../services/payment.service";

export async function handlePaymentManagement() {
  const action = await select({
    message: "Payment Management:",
    options: [
      { value: "list", label: "List All Payments" },
      { value: "bounced", label: "List Bounced Payments" },
      { value: "unpaid", label: "Unpaid Students Dashboard" },
      { value: "create", label: "Create Payment" },
      { value: "bounce", label: "Test Bounced Check (Block Student)" },
      { value: "balance", label: "Check Enrollment Balance" },
      { value: "back", label: "Back" },
    ],
  });

  if (isCancel(action) || action === "back") return;

  switch (action) {
    case "list":
      await listAllPayments();
      break;
    case "bounced":
      await listBouncedPayments();
      break;
    case "unpaid":
      await showUnpaidDashboard();
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

  if (payments.length === 0) {
    console.log("\nNo payments found.");
    return;
  }

  console.log("\nAll Payments:");
  const tableData = payments.map((p) => ({
    Status: p.status,
    Student: `${p.enrollment.student.firstName} ${p.enrollment.student.lastName}`,
    Amount: `${p.amount} DH`,
    Method: p.method,
    Period: p.period,
    Date: p.paymentDate.split("T")[0],
  }));
  console.table(tableData, Object.keys(tableData[0]));
  console.log(`\nTotal: ${payments.length} payments`);
  console.log("\nPayment IDs:");
  payments.forEach((p, i) => {
    console.log(`[${i}] ${p.id} - ${p.enrollment.student.firstName} ${p.enrollment.student.lastName}`);
  });
}

async function listBouncedPayments() {
  const s = spinner();
  s.start("Loading bounced payments...");

  const bouncedPayments = await getPaymentsByStatus("BOUNCED");
  s.stop();

  if (bouncedPayments.length === 0) {
    console.log("\nNo bounced payments found.");
    return;
  }

  console.log("\nBounced Payments:");
  const tableData = bouncedPayments.map((p) => ({
    Student: `${p.enrollment.student.firstName} ${p.enrollment.student.lastName}`,
    Amount: `${p.amount} DH`,
    Method: p.method,
    Period: p.period,
    Date: p.paymentDate.split("T")[0],
    "Student Status": p.enrollment.student.folderStatus,
  }));
  console.table(tableData, Object.keys(tableData[0]));
  console.log(`\nTotal: ${bouncedPayments.length} bounced payments`);
  console.log("\nPayment IDs:");
  bouncedPayments.forEach((p, i) => {
    console.log(`[${i}] ${p.id} - ${p.enrollment.student.firstName} ${p.enrollment.student.lastName}`);
  });
}

async function createNewPayment() {
  const enrollmentId = await text({
    message: "Enrollment ID:",
  });

  if (isCancel(enrollmentId)) return;

  const amount = await text({
    message: "Amount:",
    placeholder: "500",
  });

  if (isCancel(amount)) return;

  const method = await select({
    message: "Payment Method:",
    options: [
      { value: "CASH", label: "Cash" },
      { value: "CHECK", label: "Check" },
      { value: "CARD", label: "Card" },
    ],
  });

  if (isCancel(method)) return;

  const period = await select({
    message: "Payment Period:",
    options: [
      { value: "REGISTRATION", label: "Registration" },
      { value: "Q1", label: "Q1" },
      { value: "Q2", label: "Q2" },
      { value: "Q3", label: "Q3" },
    ],
  });

  if (isCancel(period)) return;

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

  if (isCancel(paymentId)) return;

  const confirm_ = await confirm({
    message: "This will BLOCK the student. Continue?",
  });

  if (isCancel(confirm_) || !confirm_) return;

  const s = spinner();
  s.start("Marking payment as bounced...");

  const result = await markPaymentAsBounced(paymentId as string);

  if (result.success) {
    s.stop(`CRITICAL: ${result.message}`);
  }
}

async function showUnpaidDashboard() {
  const year = await text({
    message: "Academic Year:",
    placeholder: "2025",
  });

  if (isCancel(year)) return;

  const expectedTotal = await text({
    message: "Expected Total Amount:",
    placeholder: "2000",
  });

  if (isCancel(expectedTotal)) return;

  const s = spinner();
  s.start("Generating unpaid students report...");

  const report = await getUnpaidStudents(
    parseInt(year as string),
    parseInt(expectedTotal as string)
  );

  s.stop();

  console.log(`\nUnpaid Students Dashboard - Year ${report.academicYear}`);
  console.log(`Total Unpaid Students: ${report.totalUnpaid}`);
  console.log(`Total Outstanding Debt: ${report.totalDebt} DH\n`);

  if (report.students.length === 0) {
    console.log("All students have paid in full.");
  } else {
    const tableData = report.students.map((student) => ({
      Status: student.folderStatus,
      Student: student.studentName,
      Level: student.level,
      Group: student.groupName,
      Paid: `${student.totalPaid} DH`,
      Balance: `${student.balance} DH`,
      Payments: student.paymentCount,
      Bounced: student.hasBouncedPayments ? "Yes" : "No",
      Pending: student.hasPendingPayments ? "Yes" : "No",
    }));
    console.table(tableData, Object.keys(tableData[0]));
  }
}

async function checkEnrollmentBalance() {
  const enrollmentId = await text({
    message: "Enrollment ID:",
  });

  if (isCancel(enrollmentId)) return;

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
