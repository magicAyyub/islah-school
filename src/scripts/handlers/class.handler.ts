import { select, text, spinner, isCancel } from "@clack/prompts";
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
      { value: "list", label: "List All Classes" },
      { value: "create", label: "Create New Class (Group)" },
      { value: "check", label: "Check Class Availability" },
      { value: "find", label: "Find Available Classes for Level/Slot" },
      { value: "back", label: "Back" },
    ],
  });

  if (isCancel(action) || action === "back") return;

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

  if (allClasses.length === 0) {
    console.log("\nNo classes found.");
    return;
  }

  console.log("\nAll Classes:");
  const tableData = allClasses.map((c) => ({
    Status: c.availableSpots > 0 ? "OK" : "FULL",
    Level: c.level.label,
    Day: c.slot.day,
    Period: c.slot.period,
    Group: c.groupName,
    Enrolled: c.enrolledCount,
    Capacity: c.capacityMax,
    Available: c.availableSpots,
  }));
  console.table(tableData, Object.keys(tableData[0]));
  console.log(`\nTotal: ${allClasses.length} classes`);
  console.log("\nClass IDs:");
  allClasses.forEach((c, i) => {
    console.log(`[${i}] ${c.id} - ${c.groupName}`);
  });
}

async function createNewClass() {
  const allLevels = await db.select().from(levels);
  const levelId = await select({
    message: "Select Level:",
    options: allLevels.map((l) => ({ value: l.id, label: l.label })),
  });

  if (isCancel(levelId)) return;

  const allSlots = await db.select().from(slots);
  const slotId = await select({
    message: "Select Slot:",
    options: allSlots.map((s) => ({
      value: s.id,
      label: `${s.day} - ${s.period}`,
    })),
  });

  if (isCancel(slotId)) return;

  const groupName = await text({
    message: "Group Name (e.g., Group A):",
    placeholder: "Group A",
  });

  if (isCancel(groupName)) return;

  const capacity = await text({
    message: "Maximum Capacity:",
    placeholder: "20",
  });

  if (isCancel(capacity)) return;

  const s = spinner();
  s.start("Creating class...");

  const newClass = await createClass({
    levelId: levelId as string,
    slotId: slotId as string,
    groupName: groupName as string,
    capacityMax: parseInt(capacity as string),
  });

  s.stop(`Class ${newClass.groupName} created with capacity ${newClass.capacityMax}`);
}

async function checkClassAvailability() {
  const classId = await text({
    message: "Enter Class ID:",
    placeholder: "uuid",
  });

  if (isCancel(classId)) return;

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

  if (isCancel(levelId)) return;

  const allSlots = await db.select().from(slots);
  const slotId = await select({
    message: "Select Slot:",
    options: allSlots.map((s) => ({
      value: s.id,
      label: `${s.day} - ${s.period}`,
    })),
  });

  if (isCancel(slotId)) return;

  const availableClasses = await findAvailableClasses(
    levelId as string,
    slotId as string
  );

  console.log("\n📋 Available Classes:");
  availableClasses.forEach((c) => {
    console.log(`   ${c.groupName}: ${c.availableSpots} spots available (${c.enrolledCount}/${c.capacityMax})`);
  });
}
