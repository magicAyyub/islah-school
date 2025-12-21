import "dotenv/config";
import { db } from "./index";
import { levels, slots } from "./schema";

async function main() {
  console.log("🌱 Seeding database...");

  // Insert Levels
  await db.insert(levels).values([
    { label: "Maternelle" },
    { label: "CP" },
    { label: "Niveau 1" },
    { label: "Niveau 2" },
    { label: "Niveau 3" },
    { label: "Niveau 4" },
    { label: "Jeune" },
  ]).returning();

  // 2. Insert Slots (Based on your paper form)
  await db.insert(slots).values([
    { day: "WEDNESDAY", period: "MORNING", startTime: "10:00", endTime: "13:00" },
    { day: "WEDNESDAY", period: "AFTERNOON", startTime: "13:30", endTime: "16:30" },
    { day: "SATURDAY", period: "MORNING", startTime: "10:00", endTime: "13:00" },
    { day: "SATURDAY", period: "AFTERNOON", startTime: "13:30", endTime: "16:30" },
    { day: "SUNDAY", period: "MORNING", startTime: "10:00", endTime: "13:00" },
    { day: "SUNDAY", period: "AFTERNOON", startTime: "13:30", endTime: "16:30" },
  ]);

  console.log("✅ Seeding complete!");
  process.exit(0);
}

main();