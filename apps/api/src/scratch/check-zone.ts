import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const zones = await prisma.zone.findMany({
    select: { id: true, name: true, active: true },
  });
  console.log('--- Current Zones ---');
  console.log(zones);

  if (zones.length > 0) {
    const target = zones[0];
    console.log(`\nAttempting to toggle zone: ${target.name} (${target.id}) from active=${target.active} to active=${!target.active}`);
    const updated = await prisma.zone.update({
      where: { id: target.id },
      data: { active: !target.active },
    });
    console.log('Result after toggle:', updated);

    // Toggle back
    await prisma.zone.update({
      where: { id: target.id },
      data: { active: target.active },
    });
    console.log('Restored original state.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
