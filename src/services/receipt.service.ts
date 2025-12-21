import "dotenv/config";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { db } from "../db/index";
import { payments } from "../db/schema";
import { eq } from "drizzle-orm";

interface ReceiptData {
  receiptNumber: string;
  paymentDate: string;
  studentName: string;
  guardianName: string;
  level: string;
  slot: string;
  className: string;
  academicYear: number;
  amount: string;
  method: string;
  period: string;
  status: string;
}

/**
 * Generate a receipt PDF for a payment
 */
export async function generateReceipt(paymentId: string): Promise<{ success: boolean; message: string; filePath?: string }> {
  // Fetch payment with all related data
  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
    with: {
      enrollment: {
        with: {
          student: {
            with: {
              familyLinks: {
                with: {
                  guardian: true,
                },
              },
            },
          },
          class: {
            with: {
              level: true,
              slot: true,
            },
          },
        },
      },
    },
  });

  if (!payment) {
    return { success: false, message: "Payment not found" };
  }

  if (!payment.enrollment) {
    return { success: false, message: "Enrollment data not found" };
  }

  // Extract receipt data
  const student = payment.enrollment.student;
  const classData = payment.enrollment.class;
  const primaryGuardian = student.familyLinks?.[0]?.guardian;

  const receiptData: ReceiptData = {
    receiptNumber: `REC-${payment.id.substring(0, 8).toUpperCase()}`,
    paymentDate: new Date(payment.paymentDate).toLocaleDateString("fr-FR"),
    studentName: `${student.firstName} ${student.lastName}`,
    guardianName: primaryGuardian ? `${primaryGuardian.firstName} ${primaryGuardian.lastName}` : "N/A",
    level: classData.level.label,
    slot: `${classData.slot.day} - ${classData.slot.period}`,
    className: classData.groupName,
    academicYear: payment.enrollment.academicYear,
    amount: payment.amount,
    method: payment.method,
    period: payment.period,
    status: payment.status,
  };

  // Generate PDF
  const fileName = `receipt_${payment.id}_${Date.now()}.pdf`;
  const receiptsDir = path.join(process.cwd(), "receipts");
  
  // Ensure receipts directory exists
  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }

  const filePath = path.join(receiptsDir, fileName);

  try {
    await createReceiptPDF(receiptData, filePath);
    return { 
      success: true, 
      message: `Receipt generated: ${fileName}`,
      filePath 
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Error generating receipt: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Create the PDF document with receipt template
 */
function createReceiptPDF(data: ReceiptData, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = fs.createWriteStream(filePath);

    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);

    // Header - School Info
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("École Islamique Islah", { align: "center" })
      .fontSize(10)
      .font("Helvetica")
      .text("Centre d'Enseignement Islamique", { align: "center" })
      .moveDown(0.5);

    // Receipt Title
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("REÇU DE PAIEMENT", { align: "center" })
      .moveDown(1);

    // Receipt Number and Date
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`N° Reçu: ${data.receiptNumber}`, 50, doc.y, { continued: true })
      .text(`Date: ${data.paymentDate}`, { align: "right" })
      .moveDown(1.5);

    // Divider line
    doc
      .strokeColor("#333333")
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
      .moveDown(1);

    // Student Information Section
    const leftColumn = 50;
    // const rightColumn = 300;
    let yPosition = doc.y;

    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("INFORMATIONS ÉTUDIANT", leftColumn, yPosition)
      .moveDown(0.5);

    yPosition = doc.y;

    // Left column
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Nom de l'élève:", leftColumn, yPosition)
      .font("Helvetica")
      .text(data.studentName, leftColumn + 100, yPosition)
      .moveDown(0.7);

    yPosition = doc.y;

    doc
      .font("Helvetica-Bold")
      .text("Tuteur:", leftColumn, yPosition)
      .font("Helvetica")
      .text(data.guardianName, leftColumn + 100, yPosition)
      .moveDown(0.7);

    yPosition = doc.y;

    doc
      .font("Helvetica-Bold")
      .text("Niveau:", leftColumn, yPosition)
      .font("Helvetica")
      .text(data.level, leftColumn + 100, yPosition)
      .moveDown(0.7);

    yPosition = doc.y;

    doc
      .font("Helvetica-Bold")
      .text("Horaire:", leftColumn, yPosition)
      .font("Helvetica")
      .text(data.slot, leftColumn + 100, yPosition)
      .moveDown(0.7);

    yPosition = doc.y;

    doc
      .font("Helvetica-Bold")
      .text("Groupe:", leftColumn, yPosition)
      .font("Helvetica")
      .text(data.className, leftColumn + 100, yPosition)
      .moveDown(0.7);

    yPosition = doc.y;

    doc
      .font("Helvetica-Bold")
      .text("Année Scolaire:", leftColumn, yPosition)
      .font("Helvetica")
      .text(`${data.academicYear}-${data.academicYear + 1}`, leftColumn + 100, yPosition)
      .moveDown(1.5);

    // Divider line
    doc
      .strokeColor("#333333")
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
      .moveDown(1);

    // Payment Details Section
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("DÉTAILS DU PAIEMENT", leftColumn)
      .moveDown(0.5);

    yPosition = doc.y;

    const periodLabels: Record<string, string> = {
      REGISTRATION: "Inscription",
      Q1: "Trimestre 1",
      Q2: "Trimestre 2",
      Q3: "Trimestre 3",
    };

    const methodLabels: Record<string, string> = {
      CASH: "Espèces",
      CHECK: "Chèque",
      CARD: "Carte Bancaire",
    };

    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Période:", leftColumn, yPosition)
      .font("Helvetica")
      .text(periodLabels[data.period] || data.period, leftColumn + 100, yPosition)
      .moveDown(0.7);

    yPosition = doc.y;

    doc
      .font("Helvetica-Bold")
      .text("Mode de Paiement:", leftColumn, yPosition)
      .font("Helvetica")
      .text(methodLabels[data.method] || data.method, leftColumn + 100, yPosition)
      .moveDown(0.7);

    yPosition = doc.y;

    doc
      .font("Helvetica-Bold")
      .text("Statut:", leftColumn, yPosition)
      .font("Helvetica")
      .text(data.status === "COMPLETED" ? "Complété" : data.status, leftColumn + 100, yPosition)
      .moveDown(1.5);

    // Amount Box - Highlighted
    doc
      .rect(50, doc.y, 495, 50)
      .fillAndStroke("#f0f0f0", "#333333")
      .fill("#000000");

    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("MONTANT PAYÉ:", 70, doc.y + 15)
      .fontSize(18)
      .text(`${data.amount} DH`, 400, doc.y, { align: "right" });

    doc.moveDown(3);

    // Footer
    doc
      .strokeColor("#333333")
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
      .moveDown(0.5);

    doc
      .fontSize(8)
      .font("Helvetica")
      .text(
        "Ce reçu est généré automatiquement et constitue une preuve de paiement officielle.",
        { align: "center" }
      )
      .moveDown(0.3)
      .text("Pour toute question, veuillez contacter l'administration de l'école.", { align: "center" })
      .moveDown(1)
      .fontSize(7)
      .fillColor("#666666")
      .text(`Document généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`, {
        align: "center",
      });

    doc.end();
  });
}

/**
 * Re-print an existing receipt (generates a new PDF with same data)
 */
export async function reprintReceipt(paymentId: string): Promise<{ success: boolean; message: string; filePath?: string }> {
  return generateReceipt(paymentId);
}

/**
 * Get the most recent receipt file path for a payment
 */
export async function getReceiptPath(paymentId: string): Promise<string | null> {
  const receiptsDir = path.join(process.cwd(), "receipts");
  
  if (!fs.existsSync(receiptsDir)) {
    return null;
  }

  const files = fs.readdirSync(receiptsDir);
  const paymentReceipts = files
    .filter(f => f.startsWith(`receipt_${paymentId}`))
    .sort()
    .reverse();

  if (paymentReceipts.length === 0) {
    return null;
  }

  return path.join(receiptsDir, paymentReceipts[0]);
}

/**
 * List all receipts for an enrollment
 */
export async function listEnrollmentReceipts(enrollmentId: string): Promise<string[]> {
  const enrollmentPayments = await db.query.payments.findMany({
    where: eq(payments.enrollmentId, enrollmentId),
  });

  const receiptsDir = path.join(process.cwd(), "receipts");
  
  if (!fs.existsSync(receiptsDir)) {
    return [];
  }

  const files = fs.readdirSync(receiptsDir);
  const receiptFiles: string[] = [];

  for (const payment of enrollmentPayments) {
    const paymentReceipts = files.filter(f => f.startsWith(`receipt_${payment.id}`));
    receiptFiles.push(...paymentReceipts.map(f => path.join(receiptsDir, f)));
  }

  return receiptFiles;
}
