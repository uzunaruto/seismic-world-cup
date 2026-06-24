// =============================================================================
// Discord helpers — webhook embed + reaction listener bot
// =============================================================================

export interface SubmissionEmbed {
  submissionId: string;
  handle: string;
  displayName?: string;
  magnitude?: number | null;
  pfpUrl: string;
  compositeUrl: string;
  submittedAt: string;
}

const SEISMIC_COPPER = 0xa87504;     // Magnitude 7 copper
const SEISMIC_PARCHMENT = 0xf5ebd7;
const FOOTER_TEXT = 'Seismic World Cup · moderator review';

// -----------------------------------------------------------------------------
// Post submission to #curator via webhook (no bot required for posting)
// -----------------------------------------------------------------------------
export async function postSubmissionToCurator(embed: SubmissionEmbed) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL not set');

  const payload = {
    username: 'Seismic World Cup',
    avatar_url: embed.pfpUrl,
    embeds: [
      {
        id: embed.submissionId,
        title: `New submission from @${embed.handle}`,
        description: embed.displayName
          ? `**${embed.displayName}** · ${embed.magnitude ? `Magnitude ${embed.magnitude}` : 'magnitude unknown'}`
          : `Magnitude ${embed.magnitude ?? '?'}`,
        color: SEISMIC_COPPER,
        image: { url: embed.compositeUrl },
        footer: { text: FOOTER_TEXT },
        timestamp: embed.submittedAt,
        fields: [
          {
            name: 'Approve',
            value: 'React with ✅ to publish to the gallery',
            inline: true,
          },
          {
            name: 'Reject',
            value: 'React with ❌ to reject (and add a reason in thread)',
            inline: true,
          },
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
  // Discord webhook returns the message object — capture id for reaction tracking
  return (await res.json()) as { id: string; channel_id: string };
}

// -----------------------------------------------------------------------------
// Update existing Discord message (e.g., mark as approved/rejected with new color)
// Optional — webhook can edit its own messages if we store the message id
// -----------------------------------------------------------------------------
export async function editSubmissionMessage(messageId: string, embed: SubmissionEmbed, status: 'approved' | 'rejected', reason?: string) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL not set');
  // Webhook URLs are of form: https://discord.com/api/webhooks/{id}/{token}
  // Edit endpoint: PATCH .../messages/{message_id}
  const editUrl = `${webhookUrl}/messages/${messageId}`;

  const statusEmoji = status === 'approved' ? '✅' : '❌';
  const statusColor = status === 'approved' ? 0x2aa346 : 0x9c1515;
  const statusText = status === 'approved' ? 'Published to gallery' : 'Rejected';

  const payload = {
    embeds: [
      {
        title: `${statusEmoji} ${statusText} · @${embed.handle}`,
        description: reason ? `**Reason:** ${reason}` : embed.displayName || '',
        color: statusColor,
        image: { url: embed.compositeUrl },
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
    throw new Error(`Discord message edit failed: ${res.status} ${text}`);
  }
}
