# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

We take the security of Wardix seriously, especially given its role as an access control and control plane layer managing Terminal 3 agent permissions inside secure enclaves.

If you discover a security vulnerability within Wardix, please do not disclose it publicly. Instead, please report it via private disclosure:

1. Go to the [Security Advisories](../../security/advisories) tab on GitHub.
2. Click **Report a vulnerability**.
3. Provide a detailed description of the vulnerability, including steps to reproduce it and any potential impact on the policy engine or local state data store.

We will endeavor to respond to your report within 48 hours and work with you to remediate the issue responsibly.

## Scope

The following areas are in scope for security reports:
- The Next.js dashboard and API routes (`src/app/`)
- The policy enforcement engine (`src/lib/policy.ts`)
- The T3N Client wrapper SDK (`src/lib/t3n.ts`)
- The local database mock (`src/data/db.json`)
- Pre-flight and identity check logic (`src/lib/preflight.ts` & `src/lib/db.ts`)

Thank you for helping keep Wardix secure!
