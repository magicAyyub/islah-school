import "dotenv/config";
import { db } from "../db/index";
import { classes, enrollments, levels, slots } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

interface CreateClassParams {
  levelId: string;
  slotId: string;
  groupName: string;
  capacityMax: number;
}

interface ClassWithAvailability {
  id: string;
  groupName: string;
  capacityMax: number;
  enrolledCount: number;
  availableSpots: number;
  level: { id: string; label: string };
  slot: { id: string; day: string; period: string };
}

export async function createClass(params: CreateClassParams) {
  const [newClass] = await db.insert(classes).values(params).returning();
  return newClass;
}

export async function getClassWithAvailability(classId: string): Promise<ClassWithAvailability | null> {
  const result = await db
    .select({
      id: classes.id,
      groupName: classes.groupName,
      capacityMax: classes.capacityMax,
      levelId: levels.id,
      levelLabel: levels.label,
      slotId: slots.id,
      slotDay: slots.day,
      slotPeriod: slots.period,
      enrolledCount: sql<number>`CAST(COUNT(${enrollments.id}) AS INTEGER)`,
    })
    .from(classes)
    .leftJoin(enrollments, and(
      eq(enrollments.classId, classes.id),
      eq(enrollments.status, "VALIDATED")
    ))
    .innerJoin(levels, eq(classes.levelId, levels.id))
    .innerJoin(slots, eq(classes.slotId, slots.id))
    .where(eq(classes.id, classId))
    .groupBy(classes.id, levels.id, slots.id);

  if (result.length === 0) return null;

  const row = result[0];
  return {
    id: row.id,
    groupName: row.groupName,
    capacityMax: row.capacityMax,
    enrolledCount: row.enrolledCount,
    availableSpots: row.capacityMax - row.enrolledCount,
    level: { id: row.levelId, label: row.levelLabel },
    slot: { id: row.slotId, day: row.slotDay, period: row.slotPeriod },
  };
}

export async function findAvailableClasses(levelId: string, slotId: string) {
  const result = await db
    .select({
      id: classes.id,
      groupName: classes.groupName,
      capacityMax: classes.capacityMax,
      enrolledCount: sql<number>`CAST(COUNT(${enrollments.id}) AS INTEGER)`,
    })
    .from(classes)
    .leftJoin(enrollments, and(
      eq(enrollments.classId, classes.id),
      eq(enrollments.status, "VALIDATED")
    ))
    .where(and(eq(classes.levelId, levelId), eq(classes.slotId, slotId)))
    .groupBy(classes.id)
    .having(sql`COUNT(${enrollments.id}) < ${classes.capacityMax}`);

  return result.map((row) => ({
    id: row.id,
    groupName: row.groupName,
    capacityMax: row.capacityMax,
    enrolledCount: row.enrolledCount,
    availableSpots: row.capacityMax - row.enrolledCount,
  }));
}

export async function checkClassCapacity(classId: string): Promise<boolean> {
  const classInfo = await getClassWithAvailability(classId);
  return classInfo ? classInfo.availableSpots > 0 : false;
}

export async function getAllClasses() {
  const result = await db
    .select({
      id: classes.id,
      groupName: classes.groupName,
      capacityMax: classes.capacityMax,
      levelId: levels.id,
      levelLabel: levels.label,
      slotId: slots.id,
      slotDay: slots.day,
      slotPeriod: slots.period,
      enrolledCount: sql<number>`CAST(COUNT(${enrollments.id}) AS INTEGER)`,
    })
    .from(classes)
    .leftJoin(enrollments, and(
      eq(enrollments.classId, classes.id),
      eq(enrollments.status, "VALIDATED")
    ))
    .innerJoin(levels, eq(classes.levelId, levels.id))
    .innerJoin(slots, eq(classes.slotId, slots.id))
    .groupBy(classes.id, levels.id, slots.id)
    .orderBy(levels.label, slots.day, slots.period);

  return result.map((row) => ({
    id: row.id,
    groupName: row.groupName,
    capacityMax: row.capacityMax,
    enrolledCount: row.enrolledCount,
    availableSpots: row.capacityMax - row.enrolledCount,
    level: { id: row.levelId, label: row.levelLabel },
    slot: { id: row.slotId, day: row.slotDay, period: row.slotPeriod },
  }));
}
