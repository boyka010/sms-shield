import { NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/seed';

export async function POST() {
  try {
    await seedDatabase();
    return NextResponse.json({ success: true, message: 'Database seeded successfully' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Seed failed' }, { status: 500 });
  }
}
