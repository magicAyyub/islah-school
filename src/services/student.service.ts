import "dotenv/config";
import { db } from "../db/index";
import { students } from "../db/schema";
import { eq } from "drizzle-orm";

export async function getWelcomeMessage(name: string) {
  return `Bienvenue à l'école Islah, ${name} ! La logique backend est prête.`;
}

export async function getAllStudents() {
  return await db.select().from(students);
}

export async function getStudentById(id: string) {
  return await db.query.students.findFirst({
    where: eq(students.id, id),
  });
}
