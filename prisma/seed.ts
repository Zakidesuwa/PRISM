import { PrismaClient, Role } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for PRISM...');

  // 1. Clean existing records (in reverse relation order)
  await prisma.auditLog.deleteMany();
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.productIngredient.deleteMany();
  await prisma.product.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.coopMember.deleteMany();
  await prisma.schoolBranch.deleteMany();
  await prisma.user.deleteMany();

  // 2. Seed Users
  console.log('Seeding users...');
  const adminUser = await prisma.user.create({
    data: {
      id: 'admin',
      username: 'admin',
      password: 'admin123',
      name: 'Admin User',
      role: Role.ADMIN,
    },
  });

  const cashierUser = await prisma.user.create({
    data: {
      id: 'cashier',
      username: 'user',
      password: 'user123',
      name: 'Standard Cashier',
      role: Role.CASHIER,
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      id: 'manager',
      username: 'manager',
      password: 'manager123',
      name: 'Elena Gomez',
      role: Role.MANAGER,
    },
  });

  // 3. Seed School Branches (Cooperatives)
  console.log('Seeding school branches...');
  const gordonCollege = await prisma.schoolBranch.create({
    data: {
      name: 'Gordon College',
      address: 'Olongapo City Sports Complex, East Tapinac',
      level: 'College',
      monthlyProfit: new Decimal('124500.00'),
      stockStatus: 'In Stock',
    },
  });

  const staRitaElem = await prisma.schoolBranch.create({
    data: {
      name: 'Sta. Rita Elementary',
      address: 'Sta. Rita Road, Barangay Sta. Rita',
      level: 'Elementary',
      monthlyProfit: new Decimal('88230.50'),
      stockStatus: 'Low Stock',
    },
  });

  const tapinacHigh = await prisma.schoolBranch.create({
    data: {
      name: 'Tapinac Senior High School',
      address: 'Donor Street, East Tapinac, Olongapo City',
      level: 'High School',
      monthlyProfit: new Decimal('215900.00'),
      stockStatus: 'Stock Out',
    },
  });

  const ocnhs = await prisma.schoolBranch.create({
    data: {
      name: 'Olongapo City National High School',
      address: 'Rizal Avenue corner 14th Street, East Bajac-Bajac',
      level: 'High School',
      monthlyProfit: new Decimal('92400.00'),
      stockStatus: 'In Stock',
    },
  });

  // 4. Seed Coop Members
  console.log('Seeding cooperative members...');
  const member1 = await prisma.coopMember.create({
    data: {
      memberCode: 'MEM-GC-001',
      fullName: 'Maria Santos',
      email: 'm.santos@gordoncollege.edu.ph',
      phone: '0917-123-4567',
      branchId: gordonCollege.id,
      status: 'ACTIVE',
      shareCapital: new Decimal('15000.00'),
      accumulatedPatronage: new Decimal('3420.50'),
    },
  });

  const member2 = await prisma.coopMember.create({
    data: {
      memberCode: 'MEM-SRE-002',
      fullName: 'Juan Dela Cruz',
      email: 'j.delacruz@deped.gov.ph',
      phone: '0920-987-6543',
      branchId: staRitaElem.id,
      status: 'ACTIVE',
      shareCapital: new Decimal('10000.00'),
      accumulatedPatronage: new Decimal('1850.00'),
    },
  });

  const member3 = await prisma.coopMember.create({
    data: {
      memberCode: 'MEM-THS-003',
      fullName: 'Robert Tan',
      email: 'r.tan@tapinachs.edu.ph',
      phone: '0918-555-7890',
      branchId: tapinacHigh.id,
      status: 'ACTIVE',
      shareCapital: new Decimal('20000.00'),
      accumulatedPatronage: new Decimal('5200.00'),
    },
  });

  // 5. Seed Inventory Items (Raw materials / Supplies)
  console.log('Seeding inventory items...');
  const beefPatty = await prisma.inventoryItem.create({
    data: {
      name: 'Premium Beef Patty',
      packaging: 'Box of 50',
      sku: 'PRM-BP-050',
      category: 'Proteins',
      supplier: 'Meat Masters Inc.',
      deliveryDays: 'Mon, Thu',
      price: new Decimal('4250.00'),
      stock: new Decimal('50.000'), // 50 individual patties or units
      unit: 'Pcs',
      status: 'Optimal',
    },
  });

  const briocheBuns = await prisma.inventoryItem.create({
    data: {
      name: 'Artisan Brioche Buns',
      packaging: 'Pack of 12',
      sku: 'BKY-BB-012',
      category: 'Bakery',
      supplier: 'Local Oven Co.',
      deliveryDays: 'Tue, Fri',
      price: new Decimal('300.00'),
      stock: new Decimal('100.000'), // 100 buns
      unit: 'Pcs',
      status: 'Optimal',
    },
  });

  const springWater = await prisma.inventoryItem.create({
    data: {
      name: 'Spring Water 500ml',
      packaging: 'Case of 24',
      sku: 'BEV-SW-500',
      category: 'Beverages',
      supplier: 'Aqua Pure Dist.',
      deliveryDays: 'Daily',
      price: new Decimal('625.00'),
      stock: new Decimal('145.000'),
      unit: 'Bottles',
      status: 'Optimal',
    },
  });

  const espressoBeans = await prisma.inventoryItem.create({
    data: {
      name: 'Espresso Roast Beans',
      packaging: '1kg Bag',
      sku: 'BEV-CB-1KG',
      category: 'Beverages',
      supplier: 'Global Roasters',
      deliveryDays: 'Wed',
      price: new Decimal('1200.00'),
      stock: new Decimal('32.000'), // 32.000 kg
      unit: 'kg',
      status: 'Optimal',
    },
  });

  // 6. Seed Finished Products (POS Catalog)
  console.log('Seeding products...');
  const burgerProduct = await prisma.product.create({
    data: {
      name: 'Classic Cheeseburger',
      sku: 'MEAL-001',
      category: 'Hot Meals',
      price: new Decimal('275.00'),
      stock: 45,
      image: '',
    },
  });

  const pepperoniProduct = await prisma.product.create({
    data: {
      name: 'Pepperoni Slice',
      sku: 'MEAL-012',
      category: 'Hot Meals',
      price: new Decimal('150.00'),
      stock: 20,
      image: '',
    },
  });

  const latteProduct = await prisma.product.create({
    data: {
      name: 'Iced Latte',
      sku: 'BEV-045',
      category: 'Beverages',
      price: new Decimal('225.00'),
      stock: 35,
      image: '',
    },
  });

  const waterProduct = await prisma.product.create({
    data: {
      name: 'Bottled Water',
      sku: 'BEV-001',
      category: 'Beverages',
      price: new Decimal('75.00'),
      stock: 145,
      image: '',
    },
  });

  // 7. Seed ProductIngredient Recipes (Linking Products to raw Inventory)
  console.log('Seeding product recipe ingredients...');
  // 1 Classic Cheeseburger requires 1 Beef Patty and 2 Brioche Buns
  await prisma.productIngredient.create({
    data: {
      productId: burgerProduct.id,
      inventoryItemId: beefPatty.id,
      quantityRequired: new Decimal('1.000'),
    },
  });

  await prisma.productIngredient.create({
    data: {
      productId: burgerProduct.id,
      inventoryItemId: briocheBuns.id,
      quantityRequired: new Decimal('2.000'),
    },
  });

  // 1 Iced Latte requires 0.020 kg of Espresso Roast Beans
  await prisma.productIngredient.create({
    data: {
      productId: latteProduct.id,
      inventoryItemId: espressoBeans.id,
      quantityRequired: new Decimal('0.020'),
    },
  });

  // 1 Bottled Water sells 1 Spring Water Bottle directly
  await prisma.productIngredient.create({
    data: {
      productId: waterProduct.id,
      inventoryItemId: springWater.id,
      quantityRequired: new Decimal('1.000'),
    },
  });

  // 8. Seed Initial Audit Log
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'SYSTEM_INITIALIZATION',
      entityType: 'System',
      details: JSON.stringify({ note: 'Initial schema and seed dataset loaded successfully' }),
    },
  });

  console.log('✅ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
