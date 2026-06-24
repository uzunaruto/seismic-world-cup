import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/lib/supabase';
import { faceSwapComposite, persistComposite } from '@/lib/ai';
import { postSubmissionToCurator } from '@/lib/discord';

interface SubmitBody {
  magnitude?: number;
  baseScene?: string;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check — read discord_session cookie
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
        { error: 'default_avatar', message: 'Set a custom Discord avatar to use face-swap.' },
        { status: 400 }
      );
    }

    // 3. Rate limit: max 5 submissions per 7 days per discord_id
    const { data: rateData } = await supabase
      .rpc('get_submission_count', { p_discord_id: session.discord_id, p_days: 7 })
      .single();
    const recentCount = rateData?.count ?? 0;
    if (recentCount >= 5) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Max 5 submissions per 7 days. Wait for some to be approved/rejected first.' },
        { status: 429 }
      );
    }

    // 4. Parse body
    const body: SubmitBody = await req.json().catch(() => ({}));
    const baseScene = body.baseScene || 'podium-raise';
    const magnitude = body.magnitude ?? session.magnitude ?? null;

    // 5. Create submission record (status=pending, composite=null)
    const { data: submission, error: insertErr } = await supabase
      .from('submissions')
      .insert({
        discord_id: session.discord_id,
        username: session.username,
        global_name: session.global_name,
        pfp_url: session.pfp_url,
        magnitude: typeof magnitude === 'number' ? magnitude : null,
        base_scene: baseScene,
        status: 'pending',
      })
      .select('id, submitted_at')
      .single();

    if (insertErr || !submission) {
      throw new Error(`Submission insert failed: ${insertErr?.message}`);
    }

    // 6. Run AI face-swap
    let compositeUrl: string | null = null;
    try {
      const baseSceneUrl = `${process.env.NEXT_PUBLIC_SITE_URL}${process.env.NEXT_PUBLIC_BASE_SCENE_PATH || '/assets/podium-base.png'}`;
      const result = await faceSwapComposite(session.pfp_url, baseSceneUrl);
      compositeUrl = await persistComposite(
        result.url,
        `${session.discord_id}/${submission.id}.png`
      );
      await supabase
        .from('submissions')
        .update({ composite_url: compositeUrl, raw_composite_url: result.url })
        .eq('id', submission.id);
    } catch (aiErr: any) {
      console.error('[composite-failed]', aiErr);
      // Continue without composite — mod can still review, embed will fall back to PFP
    }

    // 7. Post to Discord #curator
    try {
      const msg = await postSubmissionToCurator({
        submissionId: submission.id,
        handle: session.username,
        displayName: session.global_name || session.username,
        magnitude,
        pfpUrl: session.pfp_url,
        compositeUrl: compositeUrl || session.pfp_url,
        submittedAt: submission.submitted_at,
      });
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
      action: 'approve',  // placeholder
      reason: 'submitted',
    });

    return NextResponse.json({
      ok: true,
      submissionId: submission.id,
      compositeUrl,
    });
  } catch (err: any) {
    console.error('[submit]', err);
    return NextResponse.json({ error: err.message || 'internal_error' }, { status: 500 });
  }
}
