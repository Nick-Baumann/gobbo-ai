# Security

Milton is a single-user runtime. The binary holds API keys (xAI, Lichess) and
should be treated like any service with credentials.

## Reporting

If you find a vulnerability, do not open a public issue. Email
`security@milton.bot` with a description and reproducer. We will acknowledge
within 72 hours.

## Threat model

- Local-only: the loop never accepts inbound network traffic.
- The Lichess client and coach client are outbound only.
- Credentials live in `~/.milton/credentials/` with mode 0600.
