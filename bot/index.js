// =============================================================================
// Discord bot — listens for reactions on submitted card messages
// =============================================================================
// Run via: npm run bot  (separate process from Next.js)

const { Client, GatewayIntentBits, Events } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const CHANNEL_ID = process.env.DISCORD_CURATOR_CHANNEL_ID;
const APPROVE = '✅';
const REJECT = '❌';

if (!CHANNEL_ID) {
  console.error('DISCORD_CURATOR_CHANNEL_ID is required');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`[bot] ready as ${c.user.tag}`);
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (!reaction.message.guildId || reaction.message.channelId !== CHANNEL_ID) return;
    if (![APPROVE, REJECT].includes(reaction.emoji.name || '')) return;

    const messageId = reaction.message.id;
    const action = reaction.emoji.name === APPROVE ? 'approve' : 'reject';

    const { data: submission, error: subErr } = await supabase
      .from('submissions')
      .select('id, username, global_name, pfp_url, card_png_url, magnitude, position, kit, motto, stats, submitted_at')
      .eq('discord_message_id', messageId)
      .single();

    if (subErr || !submission) {
      console.warn(`[bot] no submission for message ${messageId}`);
      return;
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const now = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('submissions')
      .update({
        status: newStatus,
        reviewed_at: now,
        reviewer_id: user.id,
      })
      .eq('id', submission.id);

    if (updateErr) throw new Error(`Status update failed: ${updateErr.message}`);

    await supabase.from('moderator_audit').insert({
      submission_id: submission.id,
      moderator_id: user.id,
      moderator_handle: user.username || 'unknown',
      action,
    });

    // Edit the Discord message to reflect new status
    try {
      const { editSubmissionMessage } = require('../lib/discord');
      await editSubmissionMessage(
        messageId,
        {
          submissionId: submission.id,
          handle: submission.username,
          displayName: submission.global_name || submission.username,
          magnitude: submission.magnitude,
          pfpUrl: submission.pfp_url,
          cardPngUrl: submission.card_png_url || submission.pfp_url,
          position: submission.position,
          kit: submission.kit,
          motto: submission.motto,
          stats: submission.stats || { pac: 0, sho: 0, pas: 0, dri: 0, ovr: 0 },
          submittedAt: submission.submitted_at,
        },
        newStatus,
      );
    } catch (editErr) {
      console.error('[bot] discord edit failed:', editErr);
    }

    console.log(`[bot] ${user.id} ${action}d card ${submission.id} (@${submission.username})`);
  } catch (err) {
    console.error('[bot] reaction handler error:', err);
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('DISCORD_BOT_TOKEN is required.');
  process.exit(1);
}

client.login(token);
