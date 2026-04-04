import { seedDatabase } from './index';

seedDatabase()
  .then(() => {
    console.log('✅ Database seeded successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
