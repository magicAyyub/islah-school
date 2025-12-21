import { select, text, spinner } from "@clack/prompts";
import { 
  createClass, 
  getAllClasses, 
  getClassWithAvailability, 
  findAvailableClasses 
} from "../../services/class.service";
import { db } from "../../db/index";
import { levels, slots } from "../../db/schema";

export async function handleClassManagement() {
  const action = await select({
    message: "Class Management:",
    options: [
      { value: "list", label: "📋 List All Classes" },
      { value: "create", label: "Create New Class (Group)" },
      { value: "check", label: "Check Class Availability" },
      { value: "find", label: "Find Available Classes for Level/Slot" },
    ],
  });

  switch (action) {
    case "list":
      await listClasses();
      break;
    case "create":
      await createNewClass();
      break;
    case "check":
      await checkClassAvailability();
      break;
    case "find":
      await findAvailableClassesForLevelSlot();
      break;
  }
}

async function listClasses() {
  const s = spinner();
  s.start("Loading classes...");

  const allClasses = await getAllClasses();
  s.stop();

  console.log("\n📚 All Classes:");
  console.log("─".repeat(100));
  allClasses.forEach((c) => {
    const status = c.availableSpots > 0 ? "✅" : "🔴";
    console.log(
      `${status} ${c.level.label.padEnd(12)} | ${c.slot.day.padEnd(10)} ${c.slot.period.padEnd(10)} | ${c.groupName.padEnd(15)} | ${c.enrolledCount}/${c.capacityMax} (${c.availableSpots} spots)`
    );
    console.log(`   ID: ${c.id}`);
  });
  console.log("─".repeat(100));
}

async function createNewClass() {
  const allLevels = await db.select().from(levels);
  const levelId = await select({
    message: "Select Level:",
    options: allLevels.map((l) => ({ value: l.id, label: l.label })),
  });

  const allSlots = await db.select().from(slots);
  const slotId = await select({
    message: "Select Slot:",
    options: allSlots.map((s) => ({
      value: s.id,
      label: `${s.day} - ${s.period}`,
    })),
  });

  const groupName = await text({
    message: "Group Name (e.g., Group A):",
    placeholder: "Group A",
  });

  const capacity = await text({
    message: "Maximum Capacity:",
    placeholder: "20",
  });

  const s = spinner();
  s.start("Creating class...");

  const newClass = await createClass({
    levelId: levelId as string,
    slotId: slotId as string,
    groupName: groupName as string,
    capacityMax: parseInt(capacity as string),
  });

  s.stop(`✅ Class ${newClass.groupName} created with capacity ${newClass.capacityMax}`);
}

async function checkClassAvailability() {
  const classId = await text({
    message: "Enter Class ID:",
    placeholder: "uuid",
  });

  const classInfo = await getClassWithAvailability(classId as string);
  if (classInfo) {
    console.log("\n📊 Class Information:");
    console.log(`   Group: ${classInfo.groupName}`);
    console.log(`   Level: ${classInfo.level.label}`);
    console.log(`   Slot: ${classInfo.slot.day} - ${classInfo.slot.period}`);
    console.log(`   Capacity: ${classInfo.enrolledCount}/${classInfo.capacityMax}`);
    console.log(`   Available Spots: ${classInfo.availableSpots}`);
  }
}

async function findAvailableClassesForLevelSlot() {
  const allLevels = await db.select().from(levels);
  const levelId = await select({
    message: "Select Level:",
    options: allLevels.map((l) => ({ value: l.id, label: l.label })),
  });

  const allSlots = await db.select().from(slots);
  const slotId = await select({
    message: "Select Slot:",
    options: allSlots.map((s) => ({
      value: s.id,
      label: `${s.day} - ${s.period}`,
    })),
  });

  const availableClasses = await findAvailableClasses(
    levelId as string,
    slotId as string
  );

  console.log("\n📋 Available Classes:");
  availableClasses.forEach((c) => {
    console.log(`   ${c.groupName}: ${c.availableSpots} spots available (${c.enrolledCount}/${c.capacityMax})`);
  });
}
