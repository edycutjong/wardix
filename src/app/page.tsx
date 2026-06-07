'use client';

import React, { useState } from 'react';
import {
  Shield,
  Activity,
  CheckCircle,
  XCircle,
  KeyRound,
  Ban,
  Clock,
  ShieldCheck,
  Play,
  Loader2,
  Server,
  FileSignature,
  ArrowRight,
} from 'lucide-react';

type Verdict = 'allow' | 'deny';

interface Scenario {
  id: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  expect: Verdict;
  expectReason: string;
  body: {
    functions: string[];
    call: string;
    revoke?: boolean;
    expired?: boolean;
  };
}

interface RunResult {
  id: string;
  scenarioId: string;
  title: string;
  verdict: Verdict;
  reason: string;
  requestId?: string;
  businessNote?: string;
  node?: string;
  orgDid?: string;
  grantedFunctions?: string[];
  called?: string;
  live: boolean;
  ts: number;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'allow',
    title: 'In-scope call',
    desc: 'Agent invokes a function inside its grant.',
    icon: CheckCircle,
    expect: 'allow',
    expectReason: 'authorized by tee:delegation',
    body: { functions: ['compute-payroll'], call: 'compute-payroll' },
  },
  {
    id: 'scope',
    title: 'Out-of-scope call',
    desc: 'Agent invokes a function it was never granted.',
    icon: Ban,
    expect: 'deny',
    expectReason: 'function_not_allowed',
    body: { functions: ['compute-payroll'], call: 'execute-disbursement' },
  },
  {
    id: 'revoke',
    title: 'Revoked grant',
    desc: 'Org revokes on-chain, then the agent calls.',
    icon: XCircle,
    expect: 'deny',
    expectReason: 'credential_revoked',
    body: { functions: ['compute-payroll'], call: 'compute-payroll', revoke: true },
  },
  {
    id: 'expire',
    title: 'Expired grant',
    desc: 'Grant lapses before the call is made.',
    icon: Clock,
    expect: 'deny',
    expectReason: 'Expired',
    body: { functions: ['compute-payroll'], call: 'compute-payroll', expired: true },
  },
];

const STEPS = [
  { icon: KeyRound, title: 'Grant', text: 'Org signs a scoped, time-boxed delegation credential (TEE custodial sign).' },
  { icon: FileSignature, title: 'Sign', text: 'Agent signs each invocation with its own secp256k1 key.' },
  { icon: ArrowRight, title: 'Invoke', text: 'Agent submits the delegated call to tee:payroll.' },
  { icon: ShieldCheck, title: 'Verify', text: 'Contract checks scope, signatures, revocation & expiry in the TEE.' },
];

export default function WardixDashboard() {
  const [results, setResults] = useState<RunResult[]>([]);
  const [selected, setSelected] = useState<RunResult | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState<'unknown' | 'on' | 'off'>('unknown');

  const runScenario = async (s: Scenario): Promise<void> => {
    setRunningId(s.id);
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s.body),
      });

      let result: RunResult;
      if (res.ok) {
        const data = await res.json();
        setLiveMode('on');
        result = {
          id: `run_${Date.now()}_${s.id}`,
          scenarioId: s.id,
          title: s.title,
          verdict: data.verdict,
          reason: data.reason,
          requestId: data.requestId,
          businessNote: data.businessNote,
          node: data.node,
          orgDid: data.orgDid,
          grantedFunctions: data.grantedFunctions,
          called: data.called,
          live: true,
          ts: Date.now(),
        };
      } else {
        // Live mode disabled (503) — show the expected outcome as a reference.
        setLiveMode('off');
        result = {
          id: `ref_${Date.now()}_${s.id}`,
          scenarioId: s.id,
          title: s.title,
          verdict: s.expect,
          reason: s.expectReason,
          grantedFunctions: s.body.functions,
          called: s.body.call,
          live: false,
          ts: Date.now(),
        };
      }
      setResults((prev) => [result, ...prev]);
      setSelected(result);
    } catch {
      const result: RunResult = {
        id: `ref_${Date.now()}_${s.id}`,
        scenarioId: s.id,
        title: s.title,
        verdict: s.expect,
        reason: s.expectReason,
        grantedFunctions: s.body.functions,
        called: s.body.call,
        live: false,
        ts: Date.now(),
      };
      setLiveMode('off');
      setResults((prev) => [result, ...prev]);
      setSelected(result);
    } finally {
      setRunningId(null);
    }
  };

  const runAll = async () => {
    for (const s of SCENARIOS) {
      await runScenario(s);
    }
  };

  const total = results.length;
  const denied = results.filter((r) => r.verdict === 'deny').length;
  const latestByScenario = (id: string) => results.find((r) => r.scenarioId === id);

  return (
    <div className="min-h-screen bg-[#050508] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-12">
      {/* BACKGROUND GLOWS */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-emerald-950/5 rounded-full blur-[150px] pointer-events-none -z-10" />

      {/* HEADER */}
      <header className="border-b border-slate-900 bg-slate-950/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 bg-linear-to-tr from-indigo-600 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">Wardix</span>
              <span className="ml-1.5 text-xs px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-900/40 font-mono">
                control-plane
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="hidden sm:flex items-center space-x-1.5 text-[11px] font-mono text-slate-400">
              <Server className="h-3.5 w-3.5 text-indigo-400" />
              <span>testnet · tee:delegation</span>
            </span>
            <a
              href="https://github.com/edycutjong/wardix/blob/main/docs/BUGS.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-mono"
            >
              BUGS.md
            </a>
            <a
              href="https://github.com/edycutjong/wardix"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-white font-mono"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950/40 backdrop-blur-sm p-6 sm:p-8">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <KeyRound className="w-48 h-48 text-white" />
          </div>
          <div className="max-w-3xl">
            <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-indigo-950/50 border border-indigo-900/50 text-indigo-400 text-xs font-semibold mb-4">
              <Shield className="h-3 w-3" />
              <span>Terminal 3 Agent Auth SDK · live testnet</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Control Plane for Delegated AI Agents
            </h1>
            <p className="mt-3 text-base sm:text-lg text-slate-400 leading-relaxed">
              Issue scoped, revocable <code className="text-indigo-400 font-mono">did:t3n</code> delegations on Terminal 3,
              then watch every verdict come back from the <code className="text-indigo-400 font-mono">tee:delegation</code>{' '}
              contract — allowed, out-of-scope, revoked, or expired.
            </p>
          </div>

          {/* COUNTERS */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-900">
            <Counter label="Verdicts Run" value={total} icon={Activity} tone="indigo" sub="this session" />
            <Counter label="Denied" value={denied} icon={Ban} tone="red" sub="blocked at the gate" />
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-900/60 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">Mode</span>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <div
                className={`mt-2 text-2xl sm:text-3xl font-extrabold font-mono ${
                  liveMode === 'on' ? 'text-emerald-400' : liveMode === 'off' ? 'text-amber-400' : 'text-slate-500'
                }`}
              >
                {liveMode === 'on' ? 'LIVE' : liveMode === 'off' ? 'REF' : '—'}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {liveMode === 'on' ? 'real testnet verdicts' : liveMode === 'off' ? 'reference outcomes' : 'run a scenario'}
              </span>
            </div>
          </div>
        </section>

        {/* REFERENCE-MODE BANNER */}
        {liveMode === 'off' && (
          <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 flex items-start space-x-3 text-amber-200">
            <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              <span className="font-bold">Reference mode.</span> Live calls are disabled on this deployment, so the
              verdicts below are the <em>expected</em> outcomes (no <code className="font-mono">request_id</code>). For real
              testnet verdicts, run <code className="font-mono text-amber-300">npm run demo:real</code> locally, or set{' '}
              <code className="font-mono text-amber-300">T3N_LIVE=1</code> with a funded token.
            </p>
          </div>
        )}

        {/* LIVE CONSOLE */}
        <section className="bg-slate-950/40 border border-slate-900 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-4 border-b border-slate-900">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Activity className="h-5 w-5 text-indigo-400" />
                <span>Delegation Verdict Console</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Each scenario issues a real grant and submits a delegated invocation to Terminal 3.
              </p>
            </div>
            <button
              onClick={runAll}
              disabled={runningId !== null}
              className="mt-3 sm:mt-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-indigo-600/20"
            >
              {runningId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              <span>Run all scenarios</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SCENARIOS.map((s) => {
              const r = latestByScenario(s.id);
              const Icon = s.icon;
              const isRunning = runningId === s.id;
              const allow = s.expect === 'allow';
              return (
                <div
                  key={s.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                    r
                      ? r.verdict === 'allow'
                        ? 'bg-emerald-950/15 border-emerald-500/40'
                        : 'bg-red-950/15 border-red-500/40'
                      : 'bg-slate-950/60 border-slate-900'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Scenario</span>
                      <Icon className={`h-4 w-4 ${allow ? 'text-emerald-500' : 'text-red-500'}`} />
                    </div>
                    <h3 className="text-xs font-bold text-white">{s.title}</h3>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">{s.desc}</p>
                  </div>

                  {/* Inline result */}
                  {r ? (
                    <button
                      onClick={() => setSelected(r)}
                      className="mt-3 w-full text-left pt-2 border-t border-slate-900/60"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase font-mono ${
                            r.verdict === 'allow'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40'
                              : 'bg-red-950 text-red-400 border border-red-900/40'
                          }`}
                        >
                          {r.verdict}
                        </span>
                        <span
                          className={`text-[9px] font-mono ${r.live ? 'text-emerald-400' : 'text-amber-400'}`}
                        >
                          {r.live ? 'LIVE' : 'ref'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-1.5 break-words line-clamp-2">{r.reason}</p>
                    </button>
                  ) : (
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-900/60">
                      <span className={`text-[10px] font-mono ${allow ? 'text-emerald-400' : 'text-red-400'}`}>
                        EXPECT: {s.expect.toUpperCase()}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => runScenario(s)}
                    disabled={runningId !== null}
                    className="mt-3 w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 border border-slate-800 text-slate-200 rounded-lg text-[11px] font-semibold py-1.5 flex items-center justify-center space-x-1.5 transition-all"
                  >
                    {isRunning ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    <span>{isRunning ? 'Running…' : 'Run'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* TWO COLUMNS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: how it works + grant */}
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-slate-950/40 border border-slate-900 rounded-xl p-6">
              <h2 className="text-base font-bold text-white flex items-center space-x-2 mb-1">
                <KeyRound className="h-4 w-4 text-indigo-400" />
                <span>How a delegation is enforced</span>
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Wardix manages the lifecycle; Terminal 3 enforces it natively inside an Intel TDX enclave.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {STEPS.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.title} className="bg-slate-950/60 border border-slate-900 rounded-xl p-4">
                      <div className="flex items-center space-x-2 mb-1.5">
                        <div className="h-7 w-7 rounded-lg bg-indigo-950/60 border border-indigo-900/40 flex items-center justify-center">
                          <Icon className="h-3.5 w-3.5 text-indigo-400" />
                        </div>
                        <span className="text-xs font-bold text-white">
                          {i + 1}. {step.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">{step.text}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* GRANT CARD */}
            <section className="bg-slate-950/40 border border-slate-900 rounded-xl p-6">
              <h2 className="text-base font-bold text-white flex items-center space-x-2 mb-4">
                <FileSignature className="h-4 w-4 text-indigo-400" />
                <span>Active delegation grant</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <Field label="Principal (org)" value={selected?.orgDid || 'did:t3n:org (set on live call)'} mono />
                <Field label="Contract" value="tee:payroll/contracts" mono />
                <div className="sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                    Granted functions
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(selected?.grantedFunctions || ['compute-payroll']).map((fn) => (
                      <span
                        key={fn}
                        className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px] border border-slate-800"
                      >
                        {fn}
                      </span>
                    ))}
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-500 font-mono text-[10px] border border-slate-800">
                      scope: payroll/employees
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT: feed + proof */}
          <div className="space-y-8">
            <section className="bg-slate-950/40 border border-slate-900 rounded-xl p-6 flex flex-col h-[360px]">
              <div className="mb-4 pb-2 border-b border-slate-900 flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-indigo-400" />
                    <span>Verdict feed</span>
                  </h2>
                  <p className="text-xs text-slate-400">Newest first.</p>
                </div>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1.5">
                {results.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono text-center px-4">
                    Run a scenario to see live verdicts.
                  </div>
                ) : (
                  results.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selected?.id === r.id
                          ? 'bg-slate-900 border-indigo-500/80'
                          : 'bg-slate-950/60 border-slate-900 hover:border-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase font-mono ${
                            r.verdict === 'allow'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40'
                              : 'bg-red-950 text-red-400 border border-red-900/40'
                          }`}
                        >
                          {r.verdict}
                        </span>
                        <span className={`text-[9px] font-mono ${r.live ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {r.live ? 'LIVE' : 'ref'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-white font-mono truncate">{r.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 break-words line-clamp-2">{r.reason}</div>
                    </button>
                  ))
                )}
              </div>
            </section>

            {/* PROOF */}
            <section className="bg-slate-950/40 border border-slate-900 rounded-xl p-6">
              <h2 className="text-base font-bold text-white flex items-center space-x-2 mb-4">
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                <span>Proof of verdict</span>
              </h2>
              {selected ? (
                <div className="space-y-4 text-xs">
                  <Field label="Verdict" value={`${selected.verdict.toUpperCase()} — ${selected.reason}`} />
                  {selected.called && <Field label="Function called" value={selected.called} mono />}
                  {selected.requestId ? (
                    <Field label="Terminal 3 request_id" value={selected.requestId} mono accent />
                  ) : (
                    <div className="text-[11px] text-amber-300/80 font-mono">
                      reference outcome — enable live mode for a real request_id
                    </div>
                  )}
                  {selected.node && <Field label="Node" value={selected.node} mono />}
                  {selected.businessNote && <Field label="Business layer" value={selected.businessNote} mono />}
                  <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 text-indigo-300 rounded-lg text-[11px] leading-relaxed">
                    The credential is TEE-custodially signed by the org's primary wallet and verified inside an Intel TDX
                    enclave. Allow/deny is the <span className="font-mono">tee:delegation</span> contract's own decision.
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 font-mono py-6 text-center">
                  Select a verdict to inspect its proof.
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Counter({
  label,
  value,
  icon: Icon,
  tone,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'indigo' | 'red';
  sub: string;
}) {
  return (
    <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-900/60 shadow-inner">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">{label}</span>
        <Icon className={`h-4 w-4 ${tone === 'red' ? 'text-red-500' : 'text-indigo-400'}`} />
      </div>
      <div
        className={`mt-2 text-2xl sm:text-3xl font-extrabold font-mono ${
          tone === 'red' ? 'text-red-500' : 'text-white'
        }`}
      >
        {value}
      </div>
      <span className="text-[10px] text-slate-500 font-mono">{sub}</span>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">{label}</span>
      <div
        className={`bg-slate-900 p-2.5 rounded-lg border border-slate-800 break-all select-all ${
          mono ? 'font-mono' : ''
        } ${accent ? 'text-indigo-400' : 'text-white'}`}
      >
        {value}
      </div>
    </div>
  );
}
