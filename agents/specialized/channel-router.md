# Channel Router Agent

**Division**: specialized
**Type**: communication
**Capabilities**: [telegram, discord, slack, whatsapp, signal, email]

## Role

OpenClaw-style multi-platform messaging integration. Each platform is a channel with its own context namespace. Skills can be scoped per channel using channel permissions.

## Supported Platforms

### Native (Built-in)
| Platform | Status | Notes |
|----------|--------|-------|
| Telegram | ✅ | Best-supported |
| Discord | ✅ | Guild + DM, slash commands |
| Slack | ✅ | Events API + Block Kit |
| WhatsApp | ✅ | Via Baileys, requires QR scan |
| Signal | ✅ | Via signal-cli |
| Google Chat | ✅ | Workspace integration |
| Microsoft Teams | 🧪 | Beta |

### Via Skills/MCP
| Platform | Integration |
|----------|-------------|
| iMessage | macOS only (via BlueBubbles) |
| SMS | Via Twilio |
| Email | IMAP/SMTP or AgentMail |

## Key Actions

- **send_message**: Send message to channel
- **receive_message**: Process incoming message
- **get_channel_context**: Get channel-specific memory
- **set_channel_config**: Configure channel permissions
- **list_channels**: List active channels

## Channel Configuration

```yaml
channels:
  - platform: telegram
    bot_token: ${TELEGRAM_BOT_TOKEN}
    chat_id: ${TELEGRAM_CHAT_ID}
    skills:
      - gmail
      - google-calendar
      - notion
    permissions:
      - read
      - write

  - platform: discord
    bot_token: ${DISCORD_BOT_TOKEN}
    guild_id: ${DISCORD_GUILD_ID}
    skills:
      - github-mcp
      - cost-tracker
    permissions:
      - read
      - write
      - admin
```

## Channel Isolation

Each platform is a separate context namespace:
- MEMORY.md is channel-specific
- Skills can be scoped per channel
- Run 10+ channels simultaneously with per-channel permissions

## Message Format Normalization

All platforms normalized to internal format:
```json
{
  "channel": "telegram",
  "user_id": "user123",
  "message": "help me with coding",
  "timestamp": "2026-05-13T12:00:00Z",
  "attachments": []
}
```

## Rate Limits

| Platform | Rate Limit |
|----------|------------|
| Telegram | 30 msg/sec |
| Discord | 50 msg/sec |
| Slack | Variable |
| WhatsApp | 10 msg/sec |

## Security

- Never expose webhook endpoints directly
- Use Nginx reverse proxy with auth
- Rate limit per user/channel
- Log all messages for audit