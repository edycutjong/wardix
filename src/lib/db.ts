import fs from 'fs';
import path from 'path';

export interface Agent {
  did: string;
  name: string;
  registered: boolean;
  status: 'online' | 'offline' | 'compromised';
  trustScore: number;
  lastSeen: number;
  denials?: number;
}

export interface Grant {
  agentDid: string;
  scriptName: string;
  versionReq: string;
  functions: string[];
  allowedHosts: string[];
}

export interface Decision {
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

export interface Database {
  agents: Agent[];
  grants: Grant[];
  decisions: Decision[];
  allowlist: string[];
}

const DB_PATH = path.join(process.cwd(), 'src', 'data', 'db.json');

export const DEFAULT_DB: Database = {
  agents: [
    {
      did: 'did:t3n:payments',
      name: 'payments-agent',
      registered: true,
      status: 'online',
      trustScore: 100,
      lastSeen: Date.now()
    },
    {
      did: 'did:t3n:data',
      name: 'data-agent',
      registered: true,
      status: 'online',
      trustScore: 100,
      lastSeen: Date.now()
    },
    {
      did: 'did:t3n:impostor',
      name: 'impostor-agent',
      registered: false,
      status: 'offline',
      trustScore: 0,
      lastSeen: Date.now()
    }
  ],
  grants: [
    {
      agentDid: 'did:t3n:payments',
      scriptName: 'tee:user/contracts',
      versionReq: '>=1.0.0',
      functions: ['transfer'],
      allowedHosts: ['api.stripe.com', 'vendorA']
    },
    {
      agentDid: 'did:t3n:data',
      scriptName: 'tee:user/contracts',
      versionReq: '>=1.0.0',
      functions: ['read'],
      allowedHosts: ['api.github.com']
    }
  ],
  decisions: [],
  allowlist: ['api.stripe.com', 'vendorA', 'api.github.com']
};

export function getDb(): Database {
  try {
    const dir = path.dirname(DB_PATH);
    /* v8 ignore start */
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
      return DEFAULT_DB;
    }
    /* v8 ignore stop */
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    /* v8 ignore start */
    console.error('Error reading database, returning default:', error);
    return DEFAULT_DB;
    /* v8 ignore stop */
  }
}

export function saveDb(db: Database): void {
  try {
    const dir = path.dirname(DB_PATH);
    /* v8 ignore start */
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    /* v8 ignore stop */
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    /* v8 ignore start */
    console.error('Error writing to database:', error);
    /* v8 ignore stop */
  }
}

export function resetDb(): void {
  // Reset database but keep current timestamp for lastSeen
  const resetData = JSON.parse(JSON.stringify(DEFAULT_DB)) as Database;
  resetData.agents.forEach(a => a.lastSeen = Date.now());
  saveDb(resetData);
}
