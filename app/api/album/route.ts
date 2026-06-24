import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET() {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('public_album')
    .select('*')
    .limit(120);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ album: data });
}
