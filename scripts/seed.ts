import { prisma } from "../src/lib/db";
import { hash } from "bcryptjs";

async function main() {
  console.log("Seeding database...");

  const hashedPassword = await hash("password123", 12);

  // Create superadmin user
  const superadmin = await prisma.user.create({
    data: {
      email: "admin@test.com",
      name: "Admin User",
      passwordHash: hashedPassword,
      type: "STAFF",
      enabled: true,
      pending: false,
      isSuper: true,
    },
  });

  console.log("✓ Created superadmin:", superadmin.email);

  // Create staff user with permissions
  const staff = await prisma.user.create({
    data: {
      email: "staff@test.com",
      name: "Staff User",
      passwordHash: hashedPassword,
      type: "STAFF",
      enabled: true,
      pending: false,
      userRead: true,
      userWrite: true,
      orderRead: true,
      reportRead: true,
    },
  });

  console.log("✓ Created staff user:", staff.email);

  // Create partner user
  const partner = await prisma.user.create({
    data: {
      email: "partner@test.com",
      name: "Partner User",
      passwordHash: hashedPassword,
      type: "PARTNER",
      enabled: true,
      pending: false,
      orderRead: true,
      orderWrite: true,
    },
  });

  console.log("✓ Created partner user:", partner.email);

  // Create pending user (awaiting activation)
  const pending = await prisma.user.create({
    data: {
      email: "pending@test.com",
      name: "Pending User",
      passwordHash: hashedPassword,
      type: "STAFF",
      enabled: false,
      pending: true,
    },
  });

  console.log("✓ Created pending user:", pending.email);

  console.log("\nSeed completed! Test credentials:");
  console.log("- Admin: admin@test.com / password123");
  console.log("- Staff: staff@test.com / password123");
  console.log("- Partner: partner@test.com / password123");
  console.log("- Pending: pending@test.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
