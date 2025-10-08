import { PrismaClient, Role, Unit, Currency } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Categorías base
  const categories = [
    { name: 'Abarrotes', prefix: 'ABA' },
    { name: 'Farmacia', prefix: 'FAR' },
    { name: 'Panadería', prefix: 'PAN' },
    { name: 'Chucherías', prefix: 'CHU' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { prefix: cat.prefix },
      update: {},
      create: cat,
    });
  }

  // Usuarios
  const adminEmail = 'admin@demo.test';
  const adminPass = 'Admin123!';
  const adminHash = await bcrypt.hash(adminPass, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Admin',
      email: adminEmail,
      role: Role.admin,
      passwordHash: adminHash,
    },
  });

  const sellerEmail = 'seller@demo.test';
  const sellerPass = 'Seller123!';
  const sellerHash = await bcrypt.hash(sellerPass, 10);
  await prisma.user.upsert({
    where: { email: sellerEmail },
    update: {},
    create: {
      name: 'Seller',
      email: sellerEmail,
      role: Role.seller,
      passwordHash: sellerHash,
    },
  });

  // Cliente base (consumidor final)
  await prisma.client.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Consumidor Final',
      rif: null,
      address: null,
      phone: null,
      email: null,
      active: true,
    },
  });

  // Productos demo (si no hay)
  const abarrotes = await prisma.category.findUnique({
    where: { prefix: 'ABA' },
  });
  if (abarrotes) {
    const count = await prisma.product.count();
    if (count === 0) {
      await prisma.product.createMany({
        data: [
          {
            categoryId: abarrotes.id,
            code: 'ABA-0001',
            name: 'Arroz Mary 1Kg',
            unit: Unit.UNIT,
            costBs: 120.0,
            priceBs: 150.0,
            priceUsd: 0.8,
            stock: 50.0,
            minStock: 5.0,
            active: true,
          },
          {
            categoryId: abarrotes.id,
            code: 'ABA-0002',
            name: 'Azúcar 1Kg',
            unit: Unit.UNIT,
            costBs: 115.0,
            priceBs: 145.0,
            priceUsd: 0.77,
            stock: 40.0,
            minStock: 5.0,
            active: true,
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  console.log('✅ Seed listo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
