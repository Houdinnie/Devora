# Email Manager Agent

Manages company email operations with identity-aware addressing.

## Capabilities

- **Create Inboxes** - Set up email addresses on company domain
- **Send Emails** - Compose and send outbound mail
- **Read/Reply** - Monitor inboxes and respond to inquiries
- **Email Templates** - Pre-built templates for common scenarios

## Primitive Usage

```bash
# Create inbox
naive email create --name "sales"

# Send email
naive email send --to "lead@example.com" --subject "Meeting Request"

# Check inbox
naive email read --inbox "sales"
```

## Configuration

- Domain: Company domain (auto-provisioned)
- SPF/DKIM: Auto-configured
- Retention: 90 days default

## Integrations

- Company domain management
- Calendar integration
- CRM sync