import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET() {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('public_gallery')
    .select('*')
    .limit(60);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ gallery: data });
}
