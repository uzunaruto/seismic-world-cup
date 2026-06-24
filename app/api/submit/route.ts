import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/lib/supabase';
import { postSubmissionToCurator } from '@/lib/discord';
import { generateStats, Position, Kit } from '@/lib/stats';

// 10 MB max for the card PNG (1080x1620 @ 2x = ~4MB typical, allow headroom)
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('discord_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

    const supabase = getServiceSupabase();

    // 2. Load session
    const { data: session, error: sessionErr } = await supabase
      .from('discord_sessions')
      .select('discord_id, username, global_name, pfp_url, magnitude, is_default_avatar')
      .eq('session_id', sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'session_expired' }, { status: 401 });
    }
    if (session.is_default_avatar) {
      return NextResponse.json(
        { error: 'default_avatar', message: 'Set a custom Discord avatar to mint a card.' },
        { status: 400 }
      );
    }

    // 3. Rate limit
    const { data: rateData } = await supabase
      .rpc('get_submission_count', { p_discord_id: session.discord_id, p_days: 7 })
      .single();
    const recentCount = (rateData as { count?: number } | null)?.count ?? 0;
    if (recentCount >= 3) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Max 3 cards per 7 days. Wait for some to be approved/rejected first.' },
        { status: 429 }
      );
    }

    // 4. Parse multipart form
    const form = await req.formData();
    const card = form.get('card') as File | null;
    const position = form.get('position') as string | null;
    const kit = form.get('kit') as string | null;
    const motto = (form.get('motto') as string | null)?.trim() || '';

    if (!card || !(card instanceof File)) {
      return NextResponse.json({ error: 'card_missing' }, { status: 400 });
    }
    if (!position || !['forward', 'midfielder', 'defender', 'goalkeeper', 'captain', 'coach'].includes(position)) {
      return NextResponse.json({ error: 'invalid_position' }, { status: 400 });
    }
    if (!kit || !['home', 'away', 'foil'].includes(kit)) {
      return NextResponse.json({ error: 'invalid_kit' }, { status: 400 });
    }
    if (!motto || motto.length === 0 || motto.length > 80) {
      return NextResponse.json({ error: 'invalid_motto' }, { status: 400 });
    }

    // 5. Create submission record FIRST (so we have the id for the storage path)
    const stats = generateStats(session.discord_id, position as Position);
    const { data: submission, error: insertErr } = await supabase
      .from('submissions')
      .insert({
        discord_id: session.discord_id,
        username: session.username,
        global_name: session.global_name,
        pfp_url: session.pfp_url,
        magnitude: session.magnitude,
        position: position as Position,
        kit: kit as Kit,
        motto,
        stats,
        status: 'pending',
      })
      .select('id, submitted_at')
      .single();

    if (insertErr || !submission) {
      throw new Error(`Submission insert failed: ${insertErr?.message}`);
    }

    // 6. Upload card PNG to Supabase Storage
    const cardPath = `${session.discord_id}/${submission.id}.png`;
    const arrayBuffer = await card.arrayBuffer();
    const { error: uploadErr } = await supabase.storage
      .from('cards')
      .upload(cardPath, arrayBuffer, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: true,
      });
    if (uploadErr) {
      // Roll back the submission row
      await supabase.from('submissions').delete().eq('id', submission.id);
      throw new Error(`Card upload failed: ${uploadErr.message}`);
    }
    const { data: publicUrlData } = supabase.storage.from('cards').getPublicUrl(cardPath);
    const cardPngUrl = publicUrlData.publicUrl;

    // Update submission with the card URL
    await supabase
      .from('submissions')
      .update({ card_png_url: cardPngUrl })
      .eq('id', submission.id);

    // 7. Post to Discord #curator
    let discordMsgId: string | null = null;
    try {
      const msg = await postSubmissionToCurator({
        submissionId: submission.id,
        handle: session.username,
        displayName: session.global_name || session.username,
        magnitude: session.magnitude,
        pfpUrl: session.pfp_url,
        cardPngUrl,
        position,
        kit,
        motto,
        stats,
        submittedAt: submission.submitted_at,
      });
      discordMsgId = msg.id;
      await supabase
        .from('submissions')
        .update({ discord_message_id: msg.id })
        .eq('id', submission.id);
    } catch (discordErr: any) {
      console.error('[discord-webhook-failed]', discordErr);
      // Submission still in DB; mod can review via Supabase dashboard
    }

    // 8. Audit log
    await supabase.from('moderator_audit').insert({
      submission_id: submission.id,
      moderator_id: 'system',
      moderator_handle: 'system',
      action: 'approve',
      reason: 'submitted',
    });

    return NextResponse.json({
      ok: true,
      submissionId: submission.id,
      cardUrl: cardPngUrl,
    });
  } catch (err: any) {
    console.error('[submit]', err);
    return NextResponse.json({ error: err.message || 'internal_error' }, { status: 500 });
  }
}
