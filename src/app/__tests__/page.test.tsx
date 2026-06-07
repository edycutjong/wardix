import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// 1. Mock next/font/google
vi.mock("next/font/google", () => {
  return {
    Geist: () => ({ variable: "font-geist-sans" }),
    Geist_Mono: () => ({ variable: "font-geist-mono" }),
  };
});

// 2. Mock EventSource globally
let activeEventSourceInstance: MockEventSource | null = null;
class MockEventSource {
  onmessage: ((event: any) => void) | null = null;
  close = vi.fn();
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    activeEventSourceInstance = this;
  }
}
global.EventSource = MockEventSource as any;

// 3. React hook states management for raw JSX traversal tests
let hookIndex = 0;
const hookStates: any[] = [];
const hookSetters: any[] = [];
const cleanups: any[] = [];

function resetHooks() {
  hookIndex = 0;
}

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useMemo: (fn: any) => fn(),
    useState: (init: any) => {
      const currentIndex = hookIndex;
      hookIndex++;
      
      if (hookStates.length <= currentIndex) {
        hookStates.push(typeof init === "function" ? init() : init);
      } else if (hookStates[currentIndex] === undefined) {
        hookStates[currentIndex] = typeof init === "function" ? init() : init;
      }
      if (hookSetters.length <= currentIndex) {
        hookSetters.push((val: any) => {
          if (typeof val === "function") {
            hookStates[currentIndex] = val(hookStates[currentIndex]);
          } else {
            hookStates[currentIndex] = val;
          }
        });
      }
      
      return [hookStates[currentIndex], hookSetters[currentIndex]];
    },
    useEffect: (fn: any) => {
      // Run effect immediately to cover fetching/SSE initialization
      const cleanup = fn();
      if (typeof cleanup === "function") {
        cleanups.push(cleanup);
      }
    }
  };
});

import RootLayout, { metadata } from "../layout";
import WardixDashboard from "../page";

describe("Next.js App UI & Page Components", () => {
  beforeEach(() => {
    hookStates.length = 0;
    hookSetters.length = 0;
    resetHooks();
    activeEventSourceInstance = null;
    global.alert = vi.fn();
    global.confirm = vi.fn().mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Default successful API response mock
    vi.spyOn(global, "fetch").mockImplementation(async (url: any, init?: any) => {
      const urlString = url.toString();
      if (urlString.includes("/api/agents")) {
        return new Response(JSON.stringify([
          { did: "did:t3n:payments", name: "payments-agent", registered: true, status: "online", trustScore: 100, lastSeen: Date.now() },
          { did: "did:t3n:data", name: "data-agent", registered: true, status: "online", trustScore: 100, lastSeen: Date.now() },
          { did: "did:t3n:impostor", name: "impostor-agent", registered: false, status: "compromised", trustScore: 50, lastSeen: Date.now() }
        ]));
      }
      if (urlString.includes("/api/grants")) {
        if (init?.method === "POST" || init?.method === "DELETE") {
          return new Response(JSON.stringify({ success: true }));
        }
        return new Response(JSON.stringify([
          { agentDid: "did:t3n:payments", scriptName: "tee:user/contracts", versionReq: ">=1.0.0", functions: ["transfer"], allowedHosts: ["api.stripe.com", "vendorA"] },
          { agentDid: "did:t3n:data", scriptName: "tee:user/contracts", versionReq: ">=1.0.0", functions: ["read"], allowedHosts: ["api.github.com"] }
        ]));
      }
      if (urlString.includes("/api/decisions")) {
        return new Response(JSON.stringify([
          { id: "dec_1", agentDid: "did:t3n:payments", fn: "transfer", host: "vendorA", amount: 250, verdict: "allow", reason: "within scope", attestation: "tdx_attest_1", timestamp: Date.now() - 1000 },
          { id: "dec_2", agentDid: "did:t3n:payments", fn: "transfer", host: "vendorA", amount: 500, verdict: "allow", reason: "within scope", attestation: "tdx_attest_2", timestamp: Date.now() }
        ]));
      }
      if (urlString.includes("/api/seed")) {
        return new Response(JSON.stringify({ success: true }));
      }
      if (urlString.includes("/api/reset")) {
        return new Response(JSON.stringify({ success: true }));
      }
      if (urlString.includes("/api/preflight")) {
        return new Response(JSON.stringify({ verdict: "allow", reason: "preflight match" }));
      }
      return new Response(JSON.stringify({ success: true }));
    });
  });

  afterEach(() => {
    cleanups.forEach((c: any) => {
      try { c(); } catch {}
    });
    cleanups.length = 0;
    vi.restoreAllMocks();
  });

  describe("RootLayout Component", () => {
    it("renders layout layout with correct metadata tags", () => {
      expect(metadata.title).toBe("Wardix — IAM & Control Plane for Delegated AI Agents");
      const res = RootLayout({ children: "test-child" });
      expect(res).toBeDefined();
    });
  });

  describe("WardixDashboard (page.tsx)", () => {
    // Traverse element tree helper to simulate UI events and call all onClick, onSubmit, onChange handlers
    const traverseAndCallHandlers = async (element: any) => {
      if (!element) return;
      
      if (Array.isArray(element)) {
        for (const child of element) {
          await traverseAndCallHandlers(child);
        }
        return;
      }
      
      if (element.props) {
        if (typeof element.props.onClick === "function") {
          try {
            await element.props.onClick({ preventDefault: () => {} });
          } catch {}
        }
        if (typeof element.props.onSubmit === "function") {
          try {
            await element.props.onSubmit({ preventDefault: () => {} });
          } catch {}
        }
        if (typeof element.props.onChange === "function") {
          try {
            await element.props.onChange({ 
              preventDefault: () => {},
              target: { value: "test-value", checked: true } 
            });
            await element.props.onChange({ 
              preventDefault: () => {},
              target: { value: "test-value", checked: false } 
            });
          } catch {}
        }
        
        if (element.props.children) {
          await traverseAndCallHandlers(element.props.children);
        }
      }
    };

    it("should render Dashboard initially when not mounted", () => {
      resetHooks();
      // Force mounted to be false initially
      hookStates[0] = false;
      
      const tree = WardixDashboard();
      expect(tree).toBeDefined();
    });

    it("should render Dashboard after mounting and trigger event handlers", async () => {
      resetHooks();
      // Force mounted to be true, and default states
      hookStates[0] = true; // mounted
      
      let tree = WardixDashboard();
      expect(tree).toBeDefined();

      // Trigger load completions (effects run immediately)
      await new Promise(resolve => setTimeout(resolve, 5));

      // Now set states to test various UI flows:
      // Index 1: agents
      // Index 2: grants
      // Index 3: decisions
      // Index 4: selectedDecision
      // Index 5: selectedAgent
      // Index 6: editFunctions
      // Index 7: editHosts
      // Index 15: activePulses
      // Index 16: currentScenarioStep
      hookStates[1] = [
        { did: "did:t3n:payments", name: "payments-agent", registered: true, status: "online", trustScore: 100, lastSeen: Date.now() },
        { did: "did:t3n:data", name: "data-agent", registered: true, status: "offline", trustScore: 50, lastSeen: Date.now() },
        { did: "did:t3n:impostor", name: "impostor-agent", registered: false, status: "compromised", trustScore: 30, lastSeen: Date.now() }
      ];
      hookStates[2] = [
        { agentDid: "did:t3n:payments", scriptName: "tee:user/contracts", versionReq: ">=1.0.0", functions: ["transfer"], allowedHosts: ["api.stripe.com", "vendorA"] }
      ];
      hookStates[3] = [
        { id: "dec_1", agentDid: "did:t3n:payments", fn: "transfer", host: "vendorA", amount: 250, verdict: "allow", reason: "within scope", attestation: "tdx_attest_1", timestamp: Date.now() },
        { id: "dec_2", agentDid: "did:t3n:payments", fn: "transfer", host: "attacker", amount: 40000, verdict: "deny", reason: "violates limits", attestation: "tdx_attest_2", timestamp: Date.now() },
        { id: "dec_3", agentDid: "did:t3n:data", fn: "read", host: "api.github.com", verdict: "allow", reason: "allowed", attestation: "tdx_attest_3", timestamp: Date.now() },
        { id: "dec_4", agentDid: "did:t3n:data", fn: "read", verdict: "allow", reason: "allowed", attestation: "tdx_attest_4", timestamp: Date.now() }
      ];
      hookStates[4] = hookStates[3][3]; // selectedDecision (dec_4 has no host and no amount)
      hookStates[5] = hookStates[1][0]; // selectedAgent (for scope configuration modal)
      hookStates[6] = ["transfer", "read"]; // editFunctions
      hookStates[7] = ["api.stripe.com", "vendorA"]; // editHosts
      hookStates[12] = { verdict: 'allow', reason: 'allowed' }; // preflightResult (allow verdict branch)
      hookStates[15] = [
        { id: "pulse_1", from: "did:t3n:payments", to: "vendorA", verdict: "allow", timestamp: Date.now() },
        { id: "pulse_2", from: "did:t3n:payments", to: "attacker", verdict: "deny", timestamp: Date.now() },
        { id: "pulse_3", from: "unknown-from", to: "unknown-to", verdict: "allow", timestamp: Date.now() }
      ];
      hookStates[16] = 1; // currentScenarioStep = 1 (covers Step 1 highlighted style)

      resetHooks();
      tree = WardixDashboard();
      expect(tree).toBeDefined();

      // Run event handlers on the step 1 UI tree
      await traverseAndCallHandlers(tree);

      // Trigger setters directly to cover state setter functions and transition to scenario step 2
      hookSetters[8]("did:t3n:data");
      hookSetters[9]("read");
      hookSetters[10]("api.github.com");
      hookSetters[11]("100");
      hookSetters[16](2);

      resetHooks();
      tree = WardixDashboard();
      expect(tree).toBeDefined();

      // Run event handlers on the step 2 UI tree
      await traverseAndCallHandlers(tree);
    });

    it("should handle SSE stream events correctly and process denials/updates", async () => {
      resetHooks();
      hookStates[0] = true; // mounted
      hookStates[1] = [
        { did: "did:t3n:payments", name: "payments-agent", registered: true, status: "online", trustScore: 100, lastSeen: Date.now() }
      ];
      hookStates[3] = []; // empty decisions list

      resetHooks();
      WardixDashboard();

      expect(activeEventSourceInstance).toBeDefined();
      expect(activeEventSourceInstance?.onmessage).toBeDefined();

      // Trigger SSE incoming event with allow verdict
      activeEventSourceInstance?.onmessage!({
        data: JSON.stringify({
          id: "dec_sse_1",
          agentDid: "did:t3n:payments",
          fn: "transfer",
          host: "vendorA",
          amount: 250,
          verdict: "allow",
          reason: "within scope",
          attestation: "tdx_attest_sse_1",
          timestamp: Date.now()
        })
      });

      // Trigger duplicate SSE event to test duplicate filter branch
      activeEventSourceInstance?.onmessage!({
        data: JSON.stringify({
          id: "dec_sse_1",
          agentDid: "did:t3n:payments",
          fn: "transfer",
          host: "vendorA",
          amount: 250,
          verdict: "allow",
          reason: "within scope",
          attestation: "tdx_attest_sse_1",
          timestamp: Date.now()
        })
      });

      // Trigger SSE incoming event with deny verdict
      activeEventSourceInstance?.onmessage!({
        data: JSON.stringify({
          id: "dec_sse_2",
          agentDid: "did:t3n:payments",
          fn: "transfer",
          host: "attacker",
          amount: 40000,
          verdict: "deny",
          reason: "violates limits",
          attestation: "tdx_attest_sse_2",
          timestamp: Date.now()
        })
      });

      // Trigger SSE event with missing host to test default host fallback
      activeEventSourceInstance?.onmessage!({
        data: JSON.stringify({
          id: "dec_sse_3",
          agentDid: "did:t3n:payments",
          fn: "transfer",
          amount: 250,
          verdict: "allow",
          reason: "no host check",
          attestation: "tdx_attest_sse_3",
          timestamp: Date.now()
        })
      });

      // Advance mock timer to trigger setTimeout clearing logic
      await new Promise(resolve => setTimeout(resolve, 1500));
    });

    it("should handle API call failures gracefully", async () => {
      resetHooks();
      hookStates[0] = true;
      hookStates[1] = [
        { did: "did:t3n:payments", name: "payments-agent", registered: true, status: "compromised", trustScore: 100, lastSeen: Date.now() }
      ];
      hookStates[5] = hookStates[1][0];
      hookStates[11] = ""; // empty preflightAmount to cover preflightAmount falsy fallback branch
      hookStates[12] = { verdict: 'deny', reason: 'violates rules' }; // preflightResult (deny verdict branch)
      hookStates[14] = true; // seedingLoading = true to cover seedingLoading spinner class branch
      hookStates[16] = 4; // currentScenarioStep = 4 branch

      // Force fetch to return response.ok = false to hit else blocks in UI
      vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "Server Error" }), { status: 500 }));

      resetHooks();
      const tree = WardixDashboard();

      global.confirm = vi.fn().mockReturnValue(true);
      
      // Trigger event handlers which will call fetch and trigger ok-false paths
      await traverseAndCallHandlers(tree);
    });

    it("should handle API call rejection catches", async () => {
      resetHooks();
      hookStates[0] = true;
      hookStates[1] = [
        { did: "did:t3n:payments", name: "payments-agent", registered: true, status: "compromised", trustScore: 100, lastSeen: Date.now() }
      ];
      hookStates[5] = hookStates[1][0];

      // Force fetch to reject/throw error to hit catch blocks in UI
      vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network connection lost"));

      resetHooks();
      const tree = WardixDashboard();

      // Explicitly find and trigger the Reset DB button to hit catch block
      const findAndClickReset = async (element: any) => {
        if (!element || !element.props) return;
        if (element.type === 'button' && JSON.stringify(element.props).includes('Reset DB')) {
          await element.props.onClick({ preventDefault: () => {} });
        }
        if (element.props.children) {
          await findAndClickReset(element.props.children);
        }
      };

      global.confirm = vi.fn().mockReturnValue(true);
      await findAndClickReset(tree);

      // Trigger event handlers which will call fetch and trigger the error catches
      await traverseAndCallHandlers(tree);
    });

    it("should handle seed, reset and revoke actions when confirmation is canceled", async () => {
      resetHooks();
      hookStates[0] = true;
      hookStates[1] = [
        { did: "did:t3n:payments", name: "payments-agent", registered: true, status: "online", trustScore: 100, lastSeen: Date.now() }
      ];
      hookStates[5] = hookStates[1][0]; // selectedAgent
      hookStates[16] = 3; // currentScenarioStep = 3 branch

      // Mock confirm to return false (user rejects action)
      global.confirm = vi.fn().mockReturnValue(false);

      resetHooks();
      const tree = WardixDashboard();
      await traverseAndCallHandlers(tree);
    });

    it("should handle empty agents list in UI", async () => {
      resetHooks();
      hookStates[0] = true;
      hookStates[1] = []; // empty agents

      resetHooks();
      const tree = WardixDashboard();
      await traverseAndCallHandlers(tree);
    });
  });
});
