# Wardix — Terminal 3 ADK Bug & Doc Gaps Log

Findings discovered while building Wardix against the **real** `@terminal3/t3n-sdk`
(v3.5.0) on the live testnet node `https://cn-api.sg.testnet.t3n.terminal3.io`.
Every item below was hit first-hand and is reproducible with the spike/demo
scripts in `scripts/`. These target the **$200 Bug Discover Bounty** track.

> Contracts exercised: `tee:delegation/contracts` v2.0.0, `tee:payroll/contracts`
> v5.1.4, `tee:user/contracts` v2.10.0.

---

## 1. No read-back for active delegation credentials (CONFIRMED)
- **Description**: `tee:delegation/contracts` exposes `sign` and `revoke`, but there
  is no `list`/`get` to enumerate the credentials currently granted to (or by) a
  DID. The SDK surfaces `isOrgContractGrants`/`UserGrant` *types* but no client
  method to fetch them for delegation.
- **Impact**: A control plane (exactly Wardix's job) cannot reconstruct "who can
  do what right now" from the host. We must persist our own mirror of every
  credential we issue. Revocation state likewise can't be re-read.
- **Recommendation**: Add `tee:delegation/contracts::list` returning active
  `{vc_id, agent_pubkey, functions, scopes, not_after_secs, revokedFunctions}` for
  a `user_did`.

## 2. `executeAndDecode` does not resolve `script_version: "latest"`
- **Description**: Passing `script_version: "latest"` to the public
  `executeAndDecode` throws `400 Invalid action request: Invalid semver format:
  latest`. Only the private `executeUserContract` (and the typed wrappers) resolve
  "latest" via `GET /api/contracts/current`.
- **Impact**: Every public caller must hard-code or pre-fetch the deployed semver
  (e.g. `5.1.4`), which breaks the moment the contract is bumped.
- **Recommendation**: Resolve "latest" inside `executeAndDecode`, or export the
  `getScriptVersion` helper as public API.

## 3. No public wire-shape projection for delegated invocations
- **Description**: `buildPayrollInvocation` / `buildDelegationCredential` return
  objects containing `bigint` (`batch_cap_cents`, `*_secs`) and `Uint8Array`
  (`credential_jcs`, `user_sig`, `agent_sig`, `nonce`, `request_hash`). Passing
  the result straight to `executeAndDecode` throws **`Do not know how to serialize
  a BigInt`** because the transport `JSON.stringify`s it.
- **Impact**: Every caller must hand-roll the projection — bytes → `b64uEncodeBytes`,
  bigints → decimal strings — and the contract rejects any mismatch with terse
  `missing field` / `BadInput` errors. Error-prone and undocumented.
- **Recommendation**: Ship a `toWire(invocation)` / `toWire(credentialBody)` helper
  (the README even references "callers building PayrollInvocation JSON").

## 4. ETH-EOA auth uses a TEE-managed primary wallet — local signing fails
- **Description**: After `authenticate(createEthAuthInput(addr))`, the DID's
  registered *primary wallet* is a TEE-minted address (visible via
  `getSelfEthAddress()`), **not** the external key you authed with. Signing a
  credential locally with that key (`signCredential`) yields
  `400 WrongPrimaryWallet: recovered address … does not match primary wallet …`.
- **Impact**: The SDK README's "ETH-EOA users … call `signCredential` directly"
  guidance is misleading for accounts created via the standard ETH auth flow — they
  must use `DelegationCustodialClient.signCustodial` (TEE signs with the primary
  wallet). This cost hours to diagnose.
- **Recommendation**: Document the primary-wallet distinction at the
  `signCredential` call site and in the auth quickstart.

## 5. `signCustodial` requires an undocumented `v` domain-tag field
- **Description**: `DelegationCustodialClient.signCustodial(body)` rejects a body
  built from the documented `BuildDelegationCredentialOpts` fields with
  `BadInput: missing field 'v' at line 1 column …`. The body must also include
  `v: "ot3.delegation/1"` (the `DELEGATION_CREDENTIAL_DOMAIN`).
- **Recommendation**: Either inject `v` inside `signCustodial`, or add it to the
  documented body shape.

## 6. TEE refuses to *sign* an already-expired credential
- **Description**: Building a credential whose `not_after_secs` is already in the
  past and sending it to `signCustodial` returns `Expired: credential is expired`
  at **sign** time.
- **Impact**: You cannot pre-mint an expired credential to test expiry enforcement;
  you must mint a short-TTL credential and wait for it to lapse before invoking.
- **Recommendation**: Allow signing expired credentials (the invoke-time check
  already enforces expiry) or document the constraint.

## 7. Registry name requires the `/contracts` suffix
- **Description**: `GET /api/contracts/current?name=tee:payroll` →
  `not_found`, while `name=tee:payroll/contracts` → `5.1.4`. Same for
  `tee:delegation` vs `tee:delegation/contracts` and `tee:user`.
- **Recommendation**: Accept the bare name or document the suffix convention.

## 8. Credit onboarding is a chicken-and-egg trap
- **Description**: A freshly authenticated DID has zero credits; any contract call
  returns `403 InsufficientCredit (required=10000, available=0)`. The natural
  "claim" entry point, `tenant.claim()` / `tenant.me()`, **itself** costs credits,
  so it also 403s for an unfunded account. The actual credit-granting path is the
  testnet self-admit (`submitUserInput({ becomeDevTenant: true })`), which requires
  a verified email via the OTP round-trip — non-obvious from the SDK surface.
- **Recommendation**: Provide a no-precondition faucet endpoint, or document the
  self-admit → welcome-credits flow prominently in the quickstart.

## 9. No org-provisioning path — payroll lifecycle is unreachable from a dev tenant
- **Description**: To run a real `compute-payroll` / `execute-disbursement`, the
  org-data contract first needs an **organisation** entity (`createPolicy` →
  `setGrants` → `setWriters` → `writeData`). For an authenticated dev tenant,
  `createPolicy` returns `OrganisationNotFound: organisation does not exist`, and
  `submitUserInput({ becomeDevTenant: true })` only registers a *tenant*
  (`tenantAdmit: already-admitted`) — **not** an organisation. The SDK exposes no
  `createOrganisation`; the docs say orgs are seeded "by the organisation
  contract", which isn't part of `@terminal3/t3n-sdk`.
- **Impact**: The full payroll business flow cannot be completed end-to-end from a
  sandbox dev tenant. The delegation/agent-auth layer (sign, invoke, revoke,
  verdicts) works fully; everything *downstream* of it is gated on org
  provisioning that has no public entry point.
- **Recommendation**: Expose an `createOrganisation` (or testnet self-provision)
  in the SDK, or document the organisation-contract onboarding alongside the
  payroll examples so `buildPayrollInvocation` is actually runnable to completion.
