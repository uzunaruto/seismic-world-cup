// =============================================================================
// Discord helpers — webhook embed + reaction listener bot
// =============================================================================

export interface CardEmbed {
  submissionId: string;
  handle: string;
  displayName?: string;
  magnitude?: number | null;
  pfpUrl: string;
  cardPngUrl: string;
  position: string;
  kit: string;
  motto: string;
  stats: { pac: number; sho: number; pas: number; dri: number; ovr: number };
  submittedAt: string;
}

const SEISMIC_COPPER = 0xa87504;
const FOOTER_TEXT = 'Seismic World Cup · curator review';

const KIT_EMOJI: Record<string, string> = {
  home: '🏠 Home',
  away: '🛣️ Away',
  foil: '✨ Foil',
};

const POSITION_EMOJI: Record<string, string> = {
  forward: '⚽ FW',
  midfielder: '🎯 MF',
  defender: '🛡️ DF',
  goalkeeper: '🧤 GK',
  captain: '👑 C',
  coach: '📋 CO',
};

// -----------------------------------------------------------------------------
// Post submission to #curator via webhook
// -----------------------------------------------------------------------------
export async function postSubmissionToCurator(embed: CardEmbed) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL not set');

  const payload = {
    username: 'Seismic World Cup',
    avatar_url: embed.pfpUrl,
    embeds: [
      {
        id: embed.submissionId,
        title: `New card from @${embed.handle}`,
        description:
          `**${embed.displayName || embed.handle}** · ${embed.magnitude ? `Magnitude ${embed.magnitude}` : 'magnitude unknown'}\n` +
          `${POSITION_EMOJI[embed.position] || embed.position} · ${KIT_EMOJI[embed.kit] || embed.kit}\n` +
          `*“${embed.motto}”*\n\n` +
          `**Stats:** PAC ${embed.stats.pac} · SHO ${embed.stats.sho} · PAS ${embed.stats.pas} · DRI ${embed.stats.dri} · OVR ${embed.stats.ovr}`,
        color: SEISMIC_COPPER,
        image: { url: embed.cardPngUrl },
        footer: { text: FOOTER_TEXT },
        timestamp: embed.submittedAt,
        fields: [
          { name: 'Approve', value: 'React ✅ to publish to the album', inline: true },
          { name: 'Reject', value: 'React ❌ to reject (reason in thread)', inline: true },
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook failed: ${res.status} ${text}`);
  }
  return (await res.json()) as { id: string; channel_id: string };
}

// -----------------------------------------------------------------------------
// Edit the original message to reflect approval/rejection
// -----------------------------------------------------------------------------
export async function editSubmissionMessage(
  messageId: string,
  embed: CardEmbed,
  status: 'approved' | 'rejected',
  reason?: string
) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL not set');
  const editUrl = `${webhookUrl}/messages/${messageId}`;

  const statusEmoji = status === 'approved' ? '✅' : '❌';
  const statusColor = status === 'approved' ? 0x2aa346 : 0x9c1515;
  const statusText = status === 'approved' ? 'Published to album' : 'Rejected';

  const payload = {
    embeds: [
      {
        title: `${statusEmoji} ${statusText} · @${embed.handle}`,
        description: reason ? `**Reason:** ${reason}` : `${embed.motto}`,
        color: statusColor,
        image: { url: embed.cardPngUrl },
        footer: { text: FOOTER_TEXT },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const res = await fetch(editUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord edit failed: ${res.status} ${text}`);
  }
}
