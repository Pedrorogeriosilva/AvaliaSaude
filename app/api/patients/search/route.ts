import { NextResponse } from 'next/server';
import { assertCanCreateEvaluation } from '@/lib/auth';
import { searchPatients } from '@/lib/app-data';
import { normalizeSearchQuery } from '@/lib/validation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = normalizeSearchQuery(searchParams.get('q') || '');

  if (query.length < 2) {
    return NextResponse.json({ patients: [] });
  }

  try {
    await assertCanCreateEvaluation();
    const patients = await searchPatients(query);
    return NextResponse.json({ patients });
  } catch {
    return NextResponse.json({ patients: [] }, { status: 403 });
  }
}
