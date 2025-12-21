import { select, text, spinner, isCancel } from "@clack/prompts";
import { generateReceipt, reprintReceipt, listEnrollmentReceipts } from "../../services/receipt.service";
import { getAllPayments } from "../../services/payment.service";
import { getAllEnrollments } from "../../services/enrollment.service";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function handleReceiptManagement() {
  const action = await select({
    message: "Receipt Management:",
    options: [
      { value: "generate", label: "Generate Receipt for Payment" },
      { value: "reprint", label: "Re-print Receipt" },
      { value: "list", label: "List Receipts for Enrollment" },
      { value: "open", label: "Open Receipt PDF" },
      { value: "back", label: "Back" },
    ],
  });

  if (isCancel(action) || action === "back") return;

  switch (action) {
    case "generate":
      await generateReceiptForPayment();
      break;
    case "reprint":
      await reprintReceiptForPayment();
      break;
    case "list":
      await listReceiptsForEnrollment();
      break;
    case "open":
      await openReceiptPDF();
      break;
  }
}

async function generateReceiptForPayment() {
  const s = spinner();
  s.start("Loading payments...");
  const payments = await getAllPayments();
  s.stop();

  if (payments.length === 0) {
    console.log("No payments found.");
    return;
  }

  console.log("\nAvailable Payments:");
  payments.forEach((payment, i) => {
    console.log(
      `[${i}] ${payment.amount} DH - ${payment.method} - ${payment.period} - ${payment.status} (${new Date(
        payment.paymentDate
      ).toLocaleDateString()})`
    );
  });

  const paymentIndex = await text({
    message: "Enter payment number:",
    placeholder: "0",
  });

  if (isCancel(paymentIndex)) return;

  const selectedPayment = payments[parseInt(paymentIndex as string)];

  s.start("Generating receipt...");
  const result = await generateReceipt(selectedPayment.id);
  s.stop();

  if (result.success) {
    console.log(`\n✓ ${result.message}`);
    console.log(`   File: ${result.filePath}`);
  } else {
    console.log(`\n✗ Error: ${result.message}`);
  }
}

async function reprintReceiptForPayment() {
  const s = spinner();
  s.start("Loading payments...");
  const payments = await getAllPayments();
  s.stop();

  if (payments.length === 0) {
    console.log("No payments found.");
    return;
  }

  console.log("\nAvailable Payments:");
  payments.forEach((payment, i) => {
    console.log(
      `[${i}] ${payment.amount} DH - ${payment.method} - ${payment.period} - ${payment.status} (${new Date(
        payment.paymentDate
      ).toLocaleDateString()})`
    );
  });

  const paymentIndex = await text({
    message: "Enter payment number:",
    placeholder: "0",
  });

  if (isCancel(paymentIndex)) return;

  const selectedPayment = payments[parseInt(paymentIndex as string)];

  s.start("Re-printing receipt...");
  const result = await reprintReceipt(selectedPayment.id);
  s.stop();

  if (result.success) {
    console.log(`\n✓ ${result.message}`);
    console.log(`   File: ${result.filePath}`);
  } else {
    console.log(`\n✗ Error: ${result.message}`);
  }
}

async function listReceiptsForEnrollment() {
  const s = spinner();
  s.start("Loading enrollments...");
  const enrollments = await getAllEnrollments();
  s.stop();

  if (enrollments.length === 0) {
    console.log("No enrollments found.");
    return;
  }

  console.log("\nAvailable Enrollments:");
  enrollments.forEach((enrollment, i) => {
    console.log(
      `[${i}] Year ${enrollment.academicYear} - ${enrollment.type} - ${enrollment.status} - Student: ${enrollment.studentId.substring(0, 8)}`
    );
  });

  const enrollmentIndex = await text({
    message: "Enter enrollment number:",
    placeholder: "0",
  });

  if (isCancel(enrollmentIndex)) return;

  const selectedEnrollment = enrollments[parseInt(enrollmentIndex as string)];

  s.start("Finding receipts...");
  const receipts = await listEnrollmentReceipts(selectedEnrollment.id);
  s.stop();

  if (receipts.length === 0) {
    console.log("\nNo receipts found for this enrollment.");
    return;
  }

  console.log(`\nFound ${receipts.length} receipt(s):`);
  receipts.forEach((receipt, i) => {
    const fileName = receipt.split("/").pop();
    console.log(`[${i}] ${fileName}`);
  });
}

async function openReceiptPDF() {
  const s = spinner();
  s.start("Loading payments...");
  const payments = await getAllPayments();
  s.stop();

  if (payments.length === 0) {
    console.log("No payments found.");
    return;
  }

  console.log("\nAvailable Payments:");
  payments.forEach((payment, i) => {
    console.log(
      `[${i}] ${payment.amount} DH - ${payment.method} - ${payment.period} - ${payment.status} (${new Date(
        payment.paymentDate
      ).toLocaleDateString()})`
    );
  });

  const paymentIndex = await text({
    message: "Enter payment number:",
    placeholder: "0",
  });

  if (isCancel(paymentIndex)) return;

  const selectedPayment = payments[parseInt(paymentIndex as string)];

  s.start("Finding receipt...");
  const { getReceiptPath } = await import("../../services/receipt.service");
  const receiptPath = await getReceiptPath(selectedPayment.id);
  s.stop();

  if (!receiptPath) {
    console.log("\nNo receipt found for this payment. Generate one first.");
    return;
  }

  console.log(`\nOpening receipt: ${receiptPath}`);

  try {
    // Open PDF with default application (works on macOS, Linux, Windows)
    const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    await execAsync(`${command} "${receiptPath}"`);
    console.log("✓ Receipt opened in default PDF viewer");
  } catch (error) {
    console.log(`✗ Error opening receipt: ${error instanceof Error ? error.message : "Unknown error"}`);
    console.log(`   Manual path: ${receiptPath}`);
  }
}
