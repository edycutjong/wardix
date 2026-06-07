# Wardix — Terminal 3 ADK Bug & Doc Gaps Log

This document lists the architectural, design, and onboarding gaps discovered during the implementation of Wardix on the Terminal 3 Agent Dev Kit (beta). These findings target the **$200 Bug Discover Bounty** track.

---

## 1. Documented `agent-auth` Read Capability Gap
- **Description**: The ADK provides `agent-auth-update` to grant and edit permissions (e.g. `allowedHosts`, `functions`), but there is **no query capability** (e.g., `agent-auth-get` or `agent-auth-query`).
- **Impact**: Security control planes cannot read the current state of active grants directly from the host layer. Wardix had to implement a local registry database to track which grants were provisioned.
- **Recommendation**: Introduce a read-only host query capability, e.g.:
  ```ts
  const currentGrants = await client.execute({
    script_name: "tee:user/contracts",
    function_name: "agent-auth-get",
    input: { agentDid }
  });
  ```

## 2. Structured Egress Denials Payload Gap
- **Description**: When a request is blocked by the host layer via `host/http.egress_denied`, the error thrown inside Wasmtime/client is a generic error message rather than a structured object.
- **Impact**: The caller cannot programmaticly determine *which* specific host or function caused the violation, or retrieve the attestation signature of the denial, without parsing string messages.
- **Recommendation**: Return a structured exception object for egress denials:
  ```json
  {
    "code": "host/http.egress_denied",
    "details": {
      "attemptedHost": "attacker.com",
      "attemptedFunction": "transfer",
      "reason": "host not allowlisted",
      "attestation": "0xabc123..."
    }
  }
  ```

## 3. Typings and Onboarding Gaps for `EthAuthInput`
- **Description**: The TypeScript interface definitions in the documentation do not specify the exact requirements for Ethereum authorization (e.g. signature format, timestamp window bounds, or prefix requirements).
- **Impact**: Compiling ADK TypeScript applications leads to type mismatches unless casting parameters to `any`.
- **Recommendation**: Update `@terminal3/adk` type definitions to export a concrete `EthAuthInput` interface:
  ```ts
  export interface EthAuthInput {
    address: string;
    signature: string;
    timestamp: number;
  }
  ```

## 4. Cross-Contract Synchronous Calls Debug Logging
- **Description**: When using the `contracts-call` capability to invoke synchronous agent-to-agent contract flows, tracing calls across the TEE border is extremely difficult. Egress logs only record the entry and exit points, omitting the intermediate delegation chain.
- **Impact**: Auditing complex workflows (e.g., procurement agent delegating to payment agent) is impossible from the host logs.
- **Recommendation**: Append the current delegation call chain to the transaction context:
  ```json
  {
    "delegationChain": [
      "did:t3n:procurement",
      "did:t3n:payments"
    ]
  }
  ```
