import { 
  pgTable, 
  uuid, 
  varchar, 
  date, 
  integer, 
  decimal, 
  time, 
  pgEnum
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const guardianTypeEnum = pgEnum("guardian_type", ["FATHER", "MOTHER", "TUTOR"]);
export const genderEnum = pgEnum("gender", ["MALE", "FEMALE"]);
export const folderStatusEnum = pgEnum("folder_status", ["ACTIVE", "BLOCKED"]);
export const enrollmentTypeEnum = pgEnum("enrollment_type", ["NEW", "RE_ENROLLMENT"]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", ["PENDING", "VALIDATED", "CANCELED"]);
export const paymentMethodEnum = pgEnum("payment_method", ["CASH", "CHECK", "CARD"]);
export const paymentPeriodEnum = pgEnum("payment_period", ["REGISTRATION", "Q1", "Q2", "Q3"]);
export const paymentStatusEnum = pgEnum("payment_status", ["COMPLETED", "PENDING", "BOUNCED"]);
export const dayEnum = pgEnum("day", ["WEDNESDAY", "SATURDAY", "SUNDAY"]);
export const periodEnum = pgEnum("period", ["MORNING", "AFTERNOON"]);

// Guardians Table
export const guardians = pgTable("guardians", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: guardianTypeEnum("type").notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  mobilePhone: varchar("mobile_phone", { length: 20 }).notNull(),
  fixedPhone: varchar("fixed_phone", { length: 20 }),
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 100 }),
});

// Students Table
export const students = pgTable("students", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  birthDate: date("birth_date").notNull(),
  birthPlace: varchar("birth_place", { length: 100 }),
  gender: genderEnum("gender").notNull(),
  photoUrl: varchar("photo_url", { length: 500 }),
  folderStatus: folderStatusEnum("folder_status").notNull().default("ACTIVE"),
});

// Family Links Table (Junction table for Guardian-Student many-to-many)
export const familyLinks = pgTable("family_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  guardianId: uuid("guardian_id").notNull().references(() => guardians.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  relationship: varchar("relationship", { length: 50 }).notNull(),
});

// Levels Table
export const levels = pgTable("levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: varchar("label", { length: 50 }).notNull().unique(),
});

// Slots Table
export const slots = pgTable("slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  day: dayEnum("day").notNull(),
  period: periodEnum("period").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
});

// Classes Table
export const classes = pgTable("classes", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupName: varchar("group_name", { length: 50 }).notNull(),
  capacityMax: integer("capacity_max").notNull(),
  levelId: uuid("level_id").notNull().references(() => levels.id, { onDelete: "restrict" }),
  slotId: uuid("slot_id").notNull().references(() => slots.id, { onDelete: "restrict" }),
});

// Enrollments Table
export const enrollments = pgTable("enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  academicYear: integer("academic_year").notNull(),
  type: enrollmentTypeEnum("type").notNull(),
  validationDate: date("validation_date"),
  status: enrollmentStatusEnum("status").notNull().default("PENDING"),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "restrict" }),
});

// Payments Table
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  method: paymentMethodEnum("method").notNull(),
  period: paymentPeriodEnum("period").notNull(),
  status: paymentStatusEnum("status").notNull().default("PENDING"),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
});

// Relations
export const guardiansRelations = relations(guardians, ({ many }) => ({
  familyLinks: many(familyLinks),
}));

export const studentsRelations = relations(students, ({ many }) => ({
  familyLinks: many(familyLinks),
  enrollments: many(enrollments),
}));

export const familyLinksRelations = relations(familyLinks, ({ one }) => ({
  guardian: one(guardians, {
    fields: [familyLinks.guardianId],
    references: [guardians.id],
  }),
  student: one(students, {
    fields: [familyLinks.studentId],
    references: [students.id],
  }),
}));

export const levelsRelations = relations(levels, ({ many }) => ({
  classes: many(classes),
}));

export const slotsRelations = relations(slots, ({ many }) => ({
  classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  level: one(levels, {
    fields: [classes.levelId],
    references: [levels.id],
  }),
  slot: one(slots, {
    fields: [classes.slotId],
    references: [slots.id],
  }),
  enrollments: many(enrollments),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  student: one(students, {
    fields: [enrollments.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [enrollments.classId],
    references: [classes.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [payments.enrollmentId],
    references: [enrollments.id],
  }),
}));
