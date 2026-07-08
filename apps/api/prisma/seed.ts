import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

const db = new PrismaClient();
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

// A square zone around a center point (~4km side)
const square = (lat: number, lng: number, d = 0.02) => [
  [lat - d, lng - d], [lat - d, lng + d], [lat + d, lng + d], [lat + d, lng - d],
];

/** Wipe every table so the seed is idempotent and re-runnable. */
async function reset() {
  const rows = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'`;
  if (rows.length === 0) return;
  const list = rows.map(r => `"public"."${r.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function main() {
  await reset();

  const blr = await db.city.create({ data: { name: 'Bengaluru' } });

  const hsr = await db.zone.create({
    data: { cityId: blr.id, name: 'HSR Layout', polygon: square(12.9116, 77.6389) },
  });
  const kora = await db.zone.create({
    data: { cityId: blr.id, name: 'Koramangala', polygon: square(12.9352, 77.6245) },
  });

  const hub1 = await db.hub.create({
    data: { cityId: blr.id, zoneId: hsr.id, name: 'HSR Hub 1', lat: 12.9116, lng: 77.6389, capacity: 12 },
  });
  await db.hub.create({
    data: { cityId: blr.id, zoneId: kora.id, name: 'Koramangala Hub 1', lat: 12.9352, lng: 77.6245, capacity: 12 },
  });

  await db.service.createMany({
    data: [
      // icon = platform-agnostic key; each app maps it to its icon set (see ICON_KEYS in @pronto/shared)
      { slug: 'dishwashing', name: 'Dishwashing', category: 'kitchen', icon: 'dishes', baseMinutes: 30, order: 1 },
      { slug: 'kitchen-cleaning', name: 'Kitchen Cleaning', category: 'kitchen', icon: 'kitchen', baseMinutes: 45, order: 2 },
      { slug: 'kitchen-prep', name: 'Kitchen Prep (chop/knead)', category: 'kitchen', icon: 'chef', baseMinutes: 30, order: 3 },
      { slug: 'sweeping-mopping', name: 'Sweeping & Mopping', category: 'cleaning', icon: 'broom', baseMinutes: 45, order: 4 },
      { slug: 'dusting', name: 'Dusting', category: 'cleaning', icon: 'duster', baseMinutes: 30, order: 5 },
      { slug: 'bathroom-cleaning', name: 'Bathroom Cleaning', category: 'bathroom', icon: 'shower', baseMinutes: 45, order: 6 },
      { slug: 'laundry', name: 'Laundry & Folding', category: 'laundry', icon: 'laundry', baseMinutes: 45, order: 7 },
      { slug: 'ironing', name: 'Ironing', category: 'laundry', icon: 'iron', baseMinutes: 30, order: 8 },
      { slug: 'balcony-cleaning', name: 'Balcony Cleaning', category: 'cleaning', icon: 'plant', baseMinutes: 30, order: 9 },
      { slug: 'window-cleaning', name: 'Window Cleaning', category: 'cleaning', icon: 'window', baseMinutes: 30, order: 10 },
    ],
  });

  await db.pricing.createMany({
    data: [
      { cityId: blr.id, durationMin: 60, pricePaise: 16900 },
      { cityId: blr.id, durationMin: 90, pricePaise: 23900 },
      { cityId: blr.id, durationMin: 120, pricePaise: 29900 },
      { cityId: blr.id, durationMin: 180, pricePaise: 41900 },
      { cityId: blr.id, durationMin: 240, pricePaise: 52900 },
    ],
  });

  await db.coupon.createMany({
    data: [
      { code: 'FIRST50', description: '50% off your first booking', discountPct: 50, maxDiscountPaise: 15000, firstBookingOnly: true },
      { code: 'PRONTO20', description: '20% off up to ₹100', discountPct: 20, maxDiscountPaise: 10000 },
    ],
  });

  await db.trainingModule.createMany({
    data: [
      {
        title: 'Service standards & hygiene', contentUrl: 'https://example.com/train/1', order: 1,
        quiz: [{ q: 'Gloves must be worn while cleaning bathrooms?', options: ['Yes', 'No'], answerIdx: 0 }],
      },
      {
        title: 'Customer conduct & safety', contentUrl: 'https://example.com/train/2', order: 2,
        quiz: [{ q: 'If you feel unsafe you should first…', options: ['Leave silently', 'Press SOS in the app'], answerIdx: 1 }],
      },
    ],
  });

  await db.incentiveRule.create({ data: { name: 'Daily streak: 5 jobs', jobsTarget: 5, bonusPaise: 10000 } });

  await db.adminUser.createMany({
    data: [
      { email: 'admin@pronto.local', name: 'Super Admin', passwordHash: hash('admin123'), role: 'SUPER_ADMIN' },
      { email: 'ops.blr@pronto.local', name: 'BLR Ops', passwordHash: hash('ops123'), role: 'CITY_OPS', cityId: blr.id },
      { email: 'finance@pronto.local', name: 'Finance', passwordHash: hash('fin123'), role: 'FINANCE' },
    ],
  });

  // Demo workers stationed around HSR hub, already ACTIVE
  const skills = ['kitchen', 'cleaning', 'bathroom', 'laundry'];
  for (let i = 1; i <= 6; i++) {
    const u = await db.user.create({
      data: { phone: `90000000${10 + i}`, name: `Expert ${i}`, role: 'WORKER' },
    });
    await db.worker.create({
      data: {
        userId: u.id, status: 'ACTIVE', duty: 'OFF_DUTY', hubId: hub1.id,
        skills: skills.slice(0, 2 + (i % 3)), languages: ['Hindi', 'Kannada'],
        rating: 4.5 + (i % 5) / 10, jobsDone: 50 * i,
      },
    });
  }

  // Demo customer
  const cust = await db.user.create({ data: { phone: '9000000001', name: 'Demo Customer' } });
  await db.address.create({
    data: { userId: cust.id, tag: 'Home', lat: 12.9121, lng: 77.6401, flat: '402, Green Apartments', landmark: 'Near 27th Main park' },
  });

  await db.banner.create({
    data: { imageUrl: 'https://placehold.co/600x200', title: '50% off your first booking with FIRST50', order: 1 },
  });

  await db.featureFlag.createMany({
    data: [
      { key: 'surge_enabled', value: false },
      { key: 'min_app_version', value: '0.1.0' },
    ],
  });

  console.log('Seed complete. Admin: admin@pronto.local / admin123. Customer phone: 9000000001. Worker phones: 9000000011..16. OTP (dev): 123456');
}

main().finally(() => db.$disconnect());
