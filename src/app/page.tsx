'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  Zap,
  Lock,
  UserCheck,
  Trash2,
  Play,
  Info,
  Sliders,
  Sparkles
} from 'lucide-react';

interface Agent {
  did: string;
  name: string;
  registered: boolean;
  status: 'online' | 'offline' | 'compromised';
  trustScore: number;
  lastSeen: number;
  denials?: number;
}

interface Grant {
  agentDid: string;
  scriptName: string;
  versionReq: string;
  functions: string[];
  allowedHosts: string[];
}

interface Decision {
  id: string;
  agentDid: string;
  fn: string;
  host?: string;
  amount?: number;
  verdict: 'allow' | 'deny';
  reason: string;
  attestation: string;
  timestamp: number;
}

interface ActivePulse {
  id: string;
  from: string;
  to: string;
  verdict: 'allow' | 'deny';
  timestamp: number;
}

export default function WardixDashboard() {
  const [mounted, setMounted] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // Forms
  const [editFunctions, setEditFunctions] = useState<string[]>([]);
  const [editHosts, setEditHosts] = useState<string[]>([]);
  const [preflightAgent, setPreflightAgent] = useState('did:t3n:payments');
  const [preflightFn, setPreflightFn] = useState('transfer');
  const [preflightHost, setPreflightHost] = useState('vendorA');
  const [preflightAmount, setPreflightAmount] = useState('250');
  const [preflightResult, setPreflightResult] = useState<{ verdict: 'allow' | 'deny'; reason: string } | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  // States for demo
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [activePulses, setActivePulses] = useState<ActivePulse[]>([]);
  const [currentScenarioStep, setCurrentScenarioStep] = useState(0);

  // Network node positions (fixed SVG coordinates)
  const nodes = useMemo(() => ({
    'did:t3n:payments': { x: 100, y: 120, label: 'payments-agent', color: '#3b82f6' },
    'did:t3n:data': { x: 100, y: 220, label: 'data-agent', color: '#10b981' },
    'did:t3n:impostor': { x: 100, y: 320, label: 'impostor-agent', color: '#f59e0b' },
    'gateway': { x: 300, y: 220, label: 'T3N Security Gateway', color: '#6366f1' },
    'vendorA': { x: 500, y: 120, label: 'vendorA (stripe)', color: '#10b981' },
    'attacker': { x: 500, y: 320, label: 'attacker-host', color: '#ef4444' }
  }), []);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [agentsRes, grantsRes, decisionsRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/grants'),
        fetch('/api/decisions')
      ]);
      const agentsData = await agentsRes.json();
      const grantsData = await grantsRes.json();
      const decisionsData = await decisionsRes.json();

      setAgents(agentsData);
      setGrants(grantsData);
      setDecisions(decisionsData.sort((a: Decision, b: Decision) => b.timestamp - a.timestamp));
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();

    // Set up SSE Decisions stream
    const eventSource = new EventSource('/api/decisions/stream');
    eventSource.onmessage = (event) => {
      const newDecision: Decision = JSON.parse(event.data);

      // Update decisions
      setDecisions((prev) => {
        if (prev.some(d => d.id === newDecision.id)) return prev;
        const updated = [newDecision, ...prev];
        return updated.sort((a, b) => b.timestamp - a.timestamp);
      });

      // Highlight selected decision if none selected
      setSelectedDecision(newDecision);

      // Trigger graph animation pulse
      const pulseId = Math.random().toString();
      const source = newDecision.agentDid;
      const destination = newDecision.host || 'vendorA';

      const newPulse: ActivePulse = {
        id: pulseId,
        from: source,
        to: destination,
        verdict: newDecision.verdict,
        timestamp: Date.now()
      };

      setActivePulses(prev => [...prev, newPulse]);

      // Remove pulse after animation (1.2s)
      setTimeout(() => {
        setActivePulses(prev => prev.filter(p => p.id !== pulseId));
      }, 1200);

      // Refresh agents to update trust scores & status
      fetch('/api/agents')
        .then(res => res.json())
        .then(data => setAgents(data));
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Open scope edit modal/panel
  useEffect(() => {
    if (selectedAgent) {
      const grant = grants.find(g => g.agentDid === selectedAgent.did);
      setEditFunctions(grant ? grant.functions : []);
      setEditHosts(grant ? grant.allowedHosts : []);
    } else {
      setEditFunctions([]);
      setEditHosts([]);
    }
  }, [selectedAgent, grants]);

  // Seed standard scenarios
  const handleSeed = async (scenarioId: number | null) => {
    setSeedingLoading(true);
    try {
      await fetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId })
      });
      await fetchData();
      if (scenarioId !== null) {
        setCurrentScenarioStep(scenarioId);
      } else {
        setCurrentScenarioStep(0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSeedingLoading(false);
    }
  };

  // Reset database
  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset the database?')) return;
    try {
      await fetch('/api/reset', { method: 'POST' });
      setSelectedDecision(null);
      setSelectedAgent(null);
      setCurrentScenarioStep(0);
      setActivePulses([]);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Update grant scope
  const handleUpdateGrant = async () => {
    try {
      const response = await fetch('/api/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentDid: selectedAgent!.did,
          functions: editFunctions,
          allowedHosts: editHosts
        })
      });
      if (response.ok) {
        await fetchData();
        setSelectedAgent(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Revoke grant (DELETE /api/grants/:did)
  const handleRevokeGrant = async (agentDid: string) => {
    if (!confirm(`Revoke all permissions for agent ${agentDid}?`)) return;
    try {
      const response = await fetch(`/api/grants/${agentDid}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await fetchData();
        setSelectedAgent(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Preflight check
  const handlePreflight = async (e: React.FormEvent) => {
    e.preventDefault();
    setPreflightLoading(true);
    setPreflightResult(null);
    try {
      const res = await fetch('/api/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentDid: preflightAgent,
          fn: preflightFn,
          host: preflightHost,
          amount: preflightAmount ? parseFloat(preflightAmount) : undefined
        })
      });
      const data = await res.json();
      setPreflightResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setPreflightLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#05050a] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin" />
          <span className="text-sm text-slate-400 font-mono">Initializing Wardix Secure Enclave...</span>
        </div>
      </div>
    );
  }

  // Count active agents & status metrics
  const totalDecisions = decisions.length;
  const totalDenials = decisions.filter(d => d.verdict === 'deny').length;
  const activeAgentsCount = agents.filter(a => a.status === 'online').length;

  return (
    <div className="min-h-screen bg-[#050508] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-12">

      {/* BACKGROUND GLOWS */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-emerald-950/5 rounded-full blur-[150px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-1/3 w-[400px] h-[400px] bg-red-950/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* TOP HEADER */}
      <header className="border-b border-slate-900 bg-slate-950/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 bg-linear-to-tr from-indigo-600 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">Wardix</span>
              <span className="ml-1.5 text-xs px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-900/40 font-mono">control-plane</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleReset}
              className="text-xs px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all flex items-center space-x-1.5 font-mono"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Reset DB</span>
            </button>
            <a
              href="https://github.com/edycutjong/wardix/blob/main/docs/BUGS.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-mono flex items-center space-x-1"
            >
              <span>BUGS.md</span>
            </a>
            <a
              href="https://github.com/edycutjong/wardix/blob/main/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-white font-mono"
            >
              <span>Docs</span>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">

        {/* HERO / PRODUCT BANNER */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950/40 backdrop-blur-sm p-6 sm:p-8">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Lock className="w-48 h-48 text-white" />
          </div>
          <div className="max-w-3xl">
            <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-indigo-950/50 border border-indigo-900/50 text-indigo-400 text-xs font-semibold mb-4">
              <Sparkles className="h-3 w-3 animate-pulse" />
              <span>Sponsor Bounty Track: T3 Agent Auth SDK</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              IAM &amp; Policy Control Plane for AI Agents
            </h1>
            <p className="mt-3 text-base sm:text-lg text-slate-400 leading-relaxed">
              Verify agent identities via <code className="text-indigo-400 font-mono">did:t3n</code>, enforce execution scopes, and capture tamper-evident audit logs secured by hardware-level TEE attestations.
            </p>
          </div>

          {/* COUNTERS */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-900">
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-900/60 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">Adjudicated</span>
                <Activity className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-white font-mono">{totalDecisions}</div>
              <span className="text-[10px] text-slate-500 font-mono">Total contract actions</span>
            </div>

            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-900/60 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">Violations Blocked</span>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-red-500 font-mono">{totalDenials}</div>
              <span className="text-[10px] text-slate-500 font-mono">Native host blocks</span>
            </div>

            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-900/60 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">Agents Online</span>
                <UserCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">{activeAgentsCount}</div>
              <span className="text-[10px] text-slate-500 font-mono">Real-time registered DIDs</span>
            </div>
          </div>
        </section>

        {/* INCIDENT REPLAY STEPPER (DEMO TOOL) */}
        <section className="bg-slate-950/40 border border-slate-900 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-4 border-b border-slate-900">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Zap className="h-5 w-5 text-indigo-400" />
                <span>Deterministic Demo Replay Stepper</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulate Sam's 3am prompt-injection alert. Click steps to execute scenario transactions.
              </p>
            </div>
            <button
              onClick={() => handleSeed(null)}
              disabled={seedingLoading}
              className="mt-3 sm:mt-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-indigo-600/20"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${seedingLoading ? 'animate-spin' : ''}`} />
              <span>Run Full Scenario Seeding</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">

            {/* Scenario Step 1 */}
            <div
              onClick={() => handleSeed(1)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${currentScenarioStep === 1
                  ? 'bg-emerald-950/20 border-emerald-500/60 shadow-lg shadow-emerald-500/5'
                  : 'bg-slate-950/60 border-slate-900 hover:border-slate-800'
                }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Step 1</span>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                </div>
                <h3 className="text-xs font-bold text-white">Legit Transfer</h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Payments agent transfers $250 to vendorA.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-900/60">
                <span className="text-[10px] font-mono text-emerald-400">EXPECT: ALLOW</span>
                <Play className="h-3 w-3 text-slate-400" />
              </div>
            </div>

            {/* Scenario Step 2 */}
            <div
              onClick={() => handleSeed(2)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${currentScenarioStep === 2
                  ? 'bg-red-950/20 border-red-500/60 shadow-lg shadow-red-500/5'
                  : 'bg-slate-950/60 border-slate-900 hover:border-slate-800'
                }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Step 2</span>
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
                <h3 className="text-xs font-bold text-white">Data Agent Scope</h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Data-agent tries a transfer. Function not granted.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-900/60">
                <span className="text-[10px] font-mono text-red-400">EXPECT: DENY</span>
                <Play className="h-3 w-3 text-slate-400" />
              </div>
            </div>

            {/* Scenario Step 3 */}
            <div
              onClick={() => handleSeed(3)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${currentScenarioStep === 3
                  ? 'bg-red-950/20 border-red-500/60 shadow-lg shadow-red-500/5'
                  : 'bg-slate-950/60 border-slate-900 hover:border-slate-800'
                }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Step 3</span>
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
                <h3 className="text-xs font-bold text-white">Impostor Agent</h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Unregistered DID tries to make a transfer.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-900/60">
                <span className="text-[10px] font-mono text-red-400">EXPECT: DENY</span>
                <Play className="h-3 w-3 text-slate-400" />
              </div>
            </div>

            {/* Scenario Step 4 */}
            <div
              onClick={() => handleSeed(4)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${currentScenarioStep === 4
                  ? 'bg-red-950/20 border-red-500/60 shadow-lg shadow-red-500/5'
                  : 'bg-slate-950/60 border-slate-900 hover:border-slate-800'
                }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Step 4</span>
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
                <h3 className="text-xs font-bold text-white">Prompt Injection</h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Injected payments agent tries $40k to attacker-host.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-900/60">
                <span className="text-[10px] font-mono text-red-400">EXPECT: DENY</span>
                <Play className="h-3 w-3 text-slate-400" />
              </div>
            </div>

          </div>
        </section>

        {/* TWO COLUMN INTERACTIVE VIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT COLUMN: NODE GRAPH & PREFLIGHT SANDBOX (2 cols wide) */}
          <div className="lg:col-span-2 space-y-8">

            {/* INTERACTIVE NODE GRAPH */}
            <section className="bg-slate-950/40 border border-slate-900 rounded-xl p-6 relative flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-indigo-400" />
                    <span>Agent Auth Network Topology Map</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Visualizes real-time decisions. Denied calls flash red at the host gateway.
                  </p>
                </div>
                <div className="flex items-center space-x-4 text-[10px] font-mono text-slate-400">
                  <div className="flex items-center space-x-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Allow</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span>Deny</span>
                  </div>
                </div>
              </div>

              {/* SVG DYNAMIC GRAPH */}
              <div className="w-full bg-[#030306] rounded-xl border border-slate-900/80 p-4 h-[380px] flex items-center justify-center relative overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 600 440">
                  {/* Graph connections */}

                  {/* Agent connections to T3N Gateway */}
                  <path d="M 100 120 L 300 220" stroke="#1e293b" strokeWidth="2" strokeDasharray="5,5" />
                  <path d="M 100 220 L 300 220" stroke="#1e293b" strokeWidth="2" strokeDasharray="5,5" />
                  <path d="M 100 320 L 300 220" stroke="#1e293b" strokeWidth="2" strokeDasharray="5,5" />

                  {/* Gateway connections to Host Targets */}
                  <path d="M 300 220 L 500 120" stroke="#1e293b" strokeWidth="2" strokeDasharray="5,5" />
                  <path d="M 300 220 L 500 320" stroke="#1e293b" strokeWidth="2" strokeDasharray="5,5" />

                  {/* Dynamic Glowing Edges during animation */}
                  {activePulses.map(pulse => {
                    const fromNode = nodes[pulse.from as keyof typeof nodes] || nodes['did:t3n:impostor'];
                    const toNode = nodes[pulse.to as keyof typeof nodes] || nodes['attacker'];
                    const isDeny = pulse.verdict === 'deny';

                    return (
                      <g key={pulse.id}>
                        {/* Edge from source agent to gateway */}
                        <line
                          x1={fromNode.x}
                          y1={fromNode.y}
                          x2={nodes.gateway.x}
                          y2={nodes.gateway.y}
                          stroke={isDeny ? '#ef4444' : '#10b981'}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          className="animate-pulse"
                        />
                        {/* Egress target path (if allow, it goes all the way, if deny it stops at gateway) */}
                        {!isDeny && (
                          <line
                            x1={nodes.gateway.x}
                            y1={nodes.gateway.y}
                            x2={toNode.x}
                            y2={toNode.y}
                            stroke="#10b981"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />
                        )}
                        {isDeny && (
                          <line
                            x1={nodes.gateway.x}
                            y1={nodes.gateway.y}
                            x2={(nodes.gateway.x + toNode.x) / 2}
                            y2={(nodes.gateway.y + toNode.y) / 2}
                            stroke="#ef4444"
                            strokeWidth="3.5"
                            strokeDasharray="5,5"
                            strokeLinecap="round"
                            className="animate-pulse"
                          />
                        )}

                        {/* Pulse animation particle */}
                        <circle r="6" fill={isDeny ? '#ef4444' : '#10b981'}>
                          <animateMotion
                            path={`M ${fromNode.x} ${fromNode.y} L ${nodes.gateway.x} ${nodes.gateway.y} ${!isDeny ? `L ${toNode.x} ${toNode.y}` : ''}`}
                            dur="0.8s"
                            repeatCount="1"
                            fill="freeze"
                          />
                        </circle>
                      </g>
                    );
                  })}

                  {/* Draw Nodes */}

                  {/* Gateway Node */}
                  <g className="cursor-pointer">
                    <circle cx="300" cy="220" r="32" fill="#090915" stroke="#6366f1" strokeWidth="3" className="filter drop-shadow-[0_0_10px_rgba(99,102,241,0.3)]" />
                    <text x="300" y="224" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">T3N HOST</text>
                  </g>

                  {/* payments-agent */}
                  <g className="cursor-pointer" onClick={() => {
                    const agent = agents.find(a => a.did === 'did:t3n:payments');
                    if (agent) setSelectedAgent(agent);
                  }}>
                    <circle
                      cx="100"
                      cy="120"
                      r="24"
                      fill="#050510"
                      stroke={agents.find(a => a.did === 'did:t3n:payments')?.status === 'compromised' ? '#ef4444' : '#3b82f6'}
                      strokeWidth="2.5"
                    />
                    <text x="100" y="124" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">PAY</text>
                    <text x="100" y="156" fill="#94a3b8" fontSize="10" textAnchor="middle">payments-agent</text>
                  </g>

                  {/* data-agent */}
                  <g className="cursor-pointer" onClick={() => {
                    const agent = agents.find(a => a.did === 'did:t3n:data');
                    if (agent) setSelectedAgent(agent);
                  }}>
                    <circle cx="100" cy="220" r="24" fill="#050510" stroke="#10b981" strokeWidth="2.5" />
                    <text x="100" y="224" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">DATA</text>
                    <text x="100" y="256" fill="#94a3b8" fontSize="10" textAnchor="middle">data-agent</text>
                  </g>

                  {/* impostor-agent */}
                  <g className="cursor-pointer">
                    <circle cx="100" cy="320" r="24" fill="#050510" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="3,3" />
                    <text x="100" y="324" fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle">ROGUE</text>
                    <text x="100" y="356" fill="#94a3b8" fontSize="10" textAnchor="middle">impostor-agent</text>
                  </g>

                  {/* vendorA target */}
                  <g>
                    <circle cx="500" cy="120" r="22" fill="#050510" stroke="#10b981" strokeWidth="2" />
                    <text x="500" y="123" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">VendorA</text>
                    <text x="500" y="154" fill="#94a3b8" fontSize="9" textAnchor="middle">api.stripe.com</text>
                  </g>

                  {/* attacker target */}
                  <g>
                    <circle cx="500" cy="320" r="22" fill="#050510" stroke="#ef4444" strokeWidth="2" />
                    <text x="500" y="323" fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle">ATTACK</text>
                    <text x="500" y="354" fill="#ef4444" fontSize="9" textAnchor="middle">attacker.com</text>
                  </g>

                  {/* Host native lock indicator */}
                  <g transform="translate(290, 155)">
                    <rect width="20" height="20" rx="4" fill="#6366f1" className="animate-pulse" />
                    <path d="M6,13 L6,10 C6,7.8 7.8,6 10,6 C12.2,6 14,7.8 14,10 L14,13" fill="none" stroke="#ffffff" strokeWidth="1.5" />
                    <rect x="4" y="11" width="12" height="7" rx="1" fill="#ffffff" />
                  </g>
                </svg>

                {/* Live alert message on breach */}
                {activePulses.some(p => p.verdict === 'deny') && (
                  <div className="absolute top-4 left-4 right-4 bg-red-950/80 border border-red-500/40 rounded-lg p-2.5 flex items-center space-x-2.5 animate-bounce shadow-lg backdrop-blur-sm">
                    <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse shrink-0" />
                    <div className="text-[11px] font-mono text-red-200">
                      <span className="font-bold">ALERT:</span> host/http.egress_denied — rogue agent activity blocked natively!
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* PRE-FLIGHT CHECK SANDBOX */}
            <section className="bg-slate-950/40 border border-slate-900 rounded-xl p-6">
              <h2 className="text-base font-bold text-white flex items-center space-x-2 mb-2">
                <Sliders className="h-4.5 w-4.5 text-indigo-400" />
                <span>Read-Only Pre-flight Sandbox (Authorisation API)</span>
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Dry-run an agent action. The <code className="text-indigo-400 font-mono">authorisation</code> check runs without writing entries to the audit logs.
              </p>

              <form onSubmit={handlePreflight} className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Acting Agent</label>
                  <select
                    value={preflightAgent}
                    onChange={e => setPreflightAgent(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value="did:t3n:payments">payments-agent (Real)</option>
                    <option value="did:t3n:data">data-agent (Real)</option>
                    <option value="did:t3n:impostor">impostor-agent (Unregistered)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Function</label>
                  <select
                    value={preflightFn}
                    onChange={e => setPreflightFn(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value="transfer">transfer</option>
                    <option value="read">read</option>
                    <option value="write">write</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Target Host</label>
                  <select
                    value={preflightHost}
                    onChange={e => setPreflightHost(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value="vendorA">vendorA</option>
                    <option value="api.stripe.com">api.stripe.com</option>
                    <option value="api.github.com">api.github.com</option>
                    <option value="attacker">attacker</option>
                    <option value="unknown">unknown.org</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Amount ($)</label>
                  <input
                    type="number"
                    value={preflightAmount}
                    onChange={e => setPreflightAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={preflightLoading}
                  className="sm:col-span-5 w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold py-2.5 flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-indigo-600/10"
                >
                  <Activity className="h-4 w-4" />
                  <span>Execute Dry-Run Check</span>
                </button>
              </form>

              {/* Preflight results display */}
              {preflightResult && (
                <div className={`mt-6 p-4 rounded-xl border flex items-start space-x-3.5 ${preflightResult.verdict === 'allow'
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/20 border-red-500/40 text-red-200'
                  }`}>
                  <div className="mt-0.5">
                    {preflightResult.verdict === 'allow'
                      ? <CheckCircle className="h-5 w-5 text-emerald-400" />
                      : <XCircle className="h-5 w-5 text-red-400" />
                    }
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide font-mono">
                      PRE-FLIGHT DECISION: {preflightResult.verdict.toUpperCase()}
                    </h4>
                    <p className="text-xs mt-1 leading-relaxed opacity-90">
                      Reason: <span className="font-mono">{preflightResult.reason}</span>
                    </p>
                  </div>
                </div>
              )}
            </section>

          </div>

          {/* RIGHT COLUMN: DECISION STREAM FEED (1 col wide) */}
          <div className="space-y-8">

            {/* LIVE DECISION FEED */}
            <section className="bg-slate-950/40 border border-slate-900 rounded-xl p-6 flex flex-col h-[525px]">
              <div className="mb-4 pb-2 border-b border-slate-900 flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-indigo-400" />
                    <span>Real-time Decisions</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Live Server-Sent Events (SSE) feed.
                  </p>
                </div>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 scrollbar-thin">
                {decisions.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                    Awaiting agent transactions...
                  </div>
                ) : (
                  decisions.map(dec => {
                    const isAllow = dec.verdict === 'allow';
                    const agentName = dec.agentDid.split(':').pop();

                    return (
                      <div
                        key={dec.id}
                        onClick={() => setSelectedDecision(dec)}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${selectedDecision?.id === dec.id
                            ? 'bg-slate-900 border-indigo-500/80 shadow-md shadow-indigo-500/5'
                            : 'bg-slate-950/60 border-slate-900 hover:border-slate-800/80'
                          }`}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider font-mono ${isAllow
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40'
                              : 'bg-red-950 text-red-400 border border-red-900/40'
                            }`}>
                            {dec.verdict}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(dec.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-white font-mono truncate">
                          {agentName} → {dec.fn}()
                        </div>

                        {dec.host && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                            Target: {dec.host} {dec.amount ? `($${dec.amount})` : ''}
                          </div>
                        )}

                        <div className="text-[10px] text-slate-500 mt-2 truncate font-mono">
                          ID: {dec.id}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* ATTESTATION DETAILS CONTAINER */}
            <section className="bg-slate-950/40 border border-slate-900 rounded-xl p-6">
              <h2 className="text-base font-bold text-white flex items-center space-x-2 mb-4">
                <Lock className="h-4.5 w-4.5 text-indigo-400" />
                <span>TEE Attestation Signature</span>
              </h2>

              {selectedDecision ? (
                <div className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Action Attested</span>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-white break-all">
                      {selectedDecision.agentDid} called <span className="text-indigo-400">{selectedDecision.fn}</span> on host <span className="text-indigo-400">{selectedDecision.host || 'none'}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Attestation Signature</span>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-indigo-400 break-all select-all flex items-center justify-between">
                      <span>{selectedDecision.attestation}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 text-indigo-300 rounded-lg text-[11px] leading-relaxed flex space-x-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-indigo-400" />
                    <span>
                      This hash is signed using the enclave's cluster private key, verifying that policy checks were executed inside an Intel TDX VM.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 font-mono py-6 text-center">
                  Select a decision from the feed to view its attestation signature.
                </div>
              )}
            </section>

          </div>

        </div>

        {/* AGENTS REGISTRY & SCOPE EDITOR SECTION */}
        <section className="bg-slate-950/40 border border-slate-900 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 mb-4 pb-2 border-b border-slate-900">
            <UserCheck className="h-5 w-5 text-indigo-400" />
            <span>Agent Governance Directory &amp; Scope Manager</span>
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

            {/* AGENT LIST (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              {agents.map(agent => {
                const grant = grants.find(g => g.agentDid === agent.did);
                const isSelected = selectedAgent?.did === agent.did;

                return (
                  <div
                    key={agent.did}
                    className={`p-4 rounded-xl border transition-all ${isSelected
                        ? 'bg-slate-900/80 border-indigo-500/80 shadow-md shadow-indigo-500/5'
                        : 'bg-slate-950/60 border-slate-900 hover:border-slate-800/80'
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                      {/* Name and identity */}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-bold text-white">{agent.name}</h3>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono ${agent.registered
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/30'
                              : 'bg-red-950 text-red-400 border border-red-900/30'
                            }`}>
                            {agent.registered ? 'REGISTERED' : 'UNREGISTERED'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-1 select-all">{agent.did}</p>
                      </div>

                      {/* Status and Trust score */}
                      <div className="flex items-center space-x-8">
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Status</div>
                          <span className={`text-xs font-semibold ${agent.status === 'online'
                              ? 'text-emerald-400'
                              : agent.status === 'compromised'
                                ? 'text-red-400 animate-pulse'
                                : 'text-slate-500'
                            }`}>
                            {agent.status.toUpperCase()}
                          </span>
                        </div>

                        <div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Trust Score</div>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <div className="w-16 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                              <div
                                className={`h-full transition-all ${agent.trustScore > 70
                                    ? 'bg-emerald-500'
                                    : agent.trustScore > 40
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                  }`}
                                style={{ width: `${agent.trustScore}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-white">{agent.trustScore}%</span>
                          </div>
                        </div>

                      </div>

                    </div>

                    {/* Active Scopes display */}
                    <div className="mt-4 pt-3 border-t border-slate-900/60 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Allowed Functions</span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {grant && grant.functions.length > 0 ? (
                            grant.functions.map(fn => (
                              <span key={fn} className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px] border border-slate-800">
                                {fn}()
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 italic">None granted</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Allowed Hosts (Egress)</span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {grant && grant.allowedHosts.length > 0 ? (
                            grant.allowedHosts.map(host => (
                              <span key={host} className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px] border border-slate-800">
                                {host}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 italic">None granted</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions bar */}
                    {agent.registered && (
                      <div className="mt-4 pt-3 border-t border-slate-900/60 flex justify-end space-x-3">
                        <button
                          onClick={() => setSelectedAgent(agent)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center space-x-1"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>Configure Scope</span>
                        </button>
                        <button
                          onClick={() => handleRevokeGrant(agent.did)}
                          className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/50 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revoke Authority</span>
                        </button>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {/* SCOPE EDITOR SIDE PANEL (1 col) */}
            <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5 mb-2">
                <Sliders className="h-4 w-4 text-indigo-400" />
                <span>Scope Configuration</span>
              </h3>

              {selectedAgent ? (
                <div className="space-y-4 text-xs mt-4">
                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                    <div className="text-[10px] uppercase font-bold text-slate-500 font-mono">Configuring</div>
                    <div className="font-bold text-white mt-0.5">{selectedAgent.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">{selectedAgent.did}</div>
                  </div>

                  {/* Functions checklist */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Granted Functions</span>
                    <div className="space-y-1.5 bg-slate-900/50 p-2.5 rounded-lg border border-slate-900">
                      {['transfer', 'read', 'write'].map(fn => (
                        <label key={fn} className="flex items-center space-x-2 cursor-pointer text-white">
                          <input
                            type="checkbox"
                            checked={editFunctions.includes(fn)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditFunctions([...editFunctions, fn]);
                              } else {
                                setEditFunctions(editFunctions.filter(x => x !== fn));
                              }
                            }}
                            className="rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-950"
                          />
                          <span className="font-mono text-xs">{fn}()</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Allowed Hosts checklist */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Egress Allowlist Hosts</span>
                    <div className="space-y-1.5 bg-slate-900/50 p-2.5 rounded-lg border border-slate-900">
                      {['api.stripe.com', 'vendorA', 'api.github.com'].map(host => (
                        <label key={host} className="flex items-center space-x-2 cursor-pointer text-white">
                          <input
                            type="checkbox"
                            checked={editHosts.includes(host)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditHosts([...editHosts, host]);
                              } else {
                                setEditHosts(editHosts.filter(x => x !== host));
                              }
                            }}
                            className="rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-950"
                          />
                          <span className="font-mono text-xs">{host}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Save buttons */}
                  <div className="flex space-x-2 pt-2">
                    <button
                      onClick={handleUpdateGrant}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold py-2 transition-all shadow-md shadow-indigo-600/10"
                    >
                      Save Scope
                    </button>
                    <button
                      onClick={() => setSelectedAgent(null)}
                      className="px-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-semibold py-2 transition-all"
                    >
                      Cancel
                    </button>
                  </div>

                </div>
              ) : (
                <div className="text-xs text-slate-500 font-mono py-8 text-center">
                  Select "Configure Scope" on an agent to modify its delegated capabilities.
                </div>
              )}
            </div>

          </div>
        </section>

      </main>

    </div>
  );
}
