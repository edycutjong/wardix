import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as getAgents } from '../agents/route';
import { GET as getDecisions } from '../decisions/route';
import { 
  GET as getStream, 
  POST as postStream, 
  PUT as putStream, 
  DELETE as deleteStream 
} from '../decisions/stream/route';
import { GET as getGrants, POST as postGrants } from '../grants/route';
import { DELETE as deleteGrant } from '../grants/[agentDid]/route';
import { POST as postPreflight } from '../preflight/route';
import { POST as postReset } from '../reset/route';
import { POST as postSeed } from '../seed/route';
import * as dbUtils from '@/lib/db';

describe('Wardix API Routes Integration Tests', () => {
  let originalEnvToken: string | undefined;

  beforeEach(() => {
    originalEnvToken = process.env.T3N_SANDBOX_TOKEN;
    dbUtils.resetDb();
  });

  afterEach(() => {
    process.env.T3N_SANDBOX_TOKEN = originalEnvToken;
    vi.restoreAllMocks();
  });

  // 1. GET /api/agents
  describe('GET /api/agents', () => {
    it('should return all agents from the database', async () => {
      const res = await getAgents();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('did');
    });
  });

  // 2. GET /api/decisions
  describe('GET /api/decisions', () => {
    it('should return all decisions from the database', async () => {
      const res = await getDecisions();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // 3. /api/decisions/stream
  describe('/api/decisions/stream', () => {
    it('should return a readable stream for SSE and stream new decisions', async () => {
      const spySetInterval = vi.spyOn(global, 'setInterval');

      // Populate database with a new decision before starting stream
      const db = dbUtils.getDb();
      db.decisions.push({
        id: 'dec_test_stream_1',
        agentDid: 'did:t3n:payments',
        fn: 'transfer',
        host: 'vendorA',
        amount: 250,
        verdict: 'allow',
        reason: 'valid',
        attestation: 'sig',
        timestamp: Date.now()
      });
      dbUtils.saveDb(db);
      
      const res = await getStream();
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/event-stream');
      expect(res.body).toBeDefined();

      const reader = res.body!.getReader();
      const chunk = await reader.read();
      expect(chunk.value).toBeDefined();
      const text = new TextDecoder().decode(chunk.value);
      expect(text).toContain('dec_test_stream_1');

      await reader.cancel();

      // Clear any intervals created during the test to avoid hanging the process
      spySetInterval.mock.results.forEach(result => {
        if (result.value) {
          clearInterval(result.value);
        }
      });
    });

    it('should handle stream errors/disconnects when polling fails', async () => {
      const spySetInterval = vi.spyOn(global, 'setInterval');
      
      // Force getDb to throw during stream polling
      vi.spyOn(dbUtils, 'getDb').mockImplementation(() => {
        throw new Error('Database read failure during stream polling');
      });

      const res = await getStream();
      expect(res.status).toBe(200);

      // Clear any intervals created during the test to avoid hanging the process
      spySetInterval.mock.results.forEach(result => {
        if (result.value) {
          clearInterval(result.value);
        }
      });
    });

    it('should return 405 Method Not Allowed for other methods', async () => {
      const resPost = await postStream();
      expect(resPost.status).toBe(405);
      expect(await resPost.text()).toBe('Method Not Allowed');

      const resPut = await putStream();
      expect(resPut.status).toBe(405);

      const resDelete = await deleteStream();
      expect(resDelete.status).toBe(405);
    });
  });

  // 4. GET /api/grants & POST /api/grants
  describe('/api/grants', () => {
    it('GET should return all grants from database', async () => {
      const res = await getGrants();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('POST should update grants successfully with valid inputs', async () => {
      const req = new Request('http://localhost/api/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentDid: 'did:t3n:payments',
          functions: ['transfer', 'read'],
          allowedHosts: ['api.stripe.com', 'new-host.com']
        })
      });

      const res = await postGrants(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const db = dbUtils.getDb();
      const grant = db.grants.find(g => g.agentDid === 'did:t3n:payments');
      expect(grant?.allowedHosts).toContain('new-host.com');
      expect(grant?.functions).toContain('read');
    });

    it('POST should use default fallback sandbox token when env token is missing', async () => {
      delete process.env.T3N_SANDBOX_TOKEN;
      const req = new Request('http://localhost/api/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentDid: 'did:t3n:payments',
          functions: ['transfer'],
          allowedHosts: ['api.stripe.com']
        })
      });

      const res = await postGrants(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('POST should return 400 for missing or invalid parameters', async () => {
      const req = new Request('http://localhost/api/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentDid: '',
          functions: 'not-an-array',
          allowedHosts: []
        })
      });

      const res = await postGrants(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Missing or invalid parameters');
    });

    it('POST should handle internal server errors gracefully with fallback message', async () => {
      const req = {
        json: () => Promise.reject({ message: '' })
      } as any;

      const res = await postGrants(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  // 5. DELETE /api/grants/[agentDid]
  describe('DELETE /api/grants/[agentDid]', () => {
    it('should revoke the grant successfully if it exists', async () => {
      const req = new Request('http://localhost/api/grants/did:t3n:payments', { method: 'DELETE' });
      const res = await deleteGrant(req, { params: Promise.resolve({ agentDid: 'did:t3n:payments' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Grant revoked');

      const db = dbUtils.getDb();
      expect(db.grants.some(g => g.agentDid === 'did:t3n:payments')).toBe(false);
    });

    it('should return 404 if the grant does not exist', async () => {
      const req = new Request('http://localhost/api/grants/did:t3n:nonexistent', { method: 'DELETE' });
      const res = await deleteGrant(req, { params: Promise.resolve({ agentDid: 'did:t3n:nonexistent' }) });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Grant not found');
    });

    it('should handle internal errors with default fallback message', async () => {
      const req = new Request('http://localhost/api/grants/did:t3n:payments', { method: 'DELETE' });
      // Throw an error with empty message to hit the fallback operator
      const res = await deleteGrant(req, { params: Promise.reject({ message: '' }) });
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  // 6. POST /api/preflight
  describe('POST /api/preflight', () => {
    it('should run a successful preflight dry-run check', async () => {
      const req = new Request('http://localhost/api/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentDid: 'did:t3n:payments',
          fn: 'transfer',
          host: 'vendorA',
          amount: 250
        })
      });

      const res = await postPreflight(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.verdict).toBe('allow');
    });

    it('should return 400 for missing agentDid or fn', async () => {
      const req = new Request('http://localhost/api/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentDid: 'did:t3n:payments'
        })
      });

      const res = await postPreflight(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Missing agentDid or fn');
    });

    it('should handle internal errors gracefully with default fallback message', async () => {
      const req = {
        json: () => Promise.reject({ message: '' })
      } as any;

      const res = await postPreflight(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  // 7. POST /api/reset
  describe('POST /api/reset', () => {
    it('should reset the database to default settings successfully', async () => {
      const res = await postReset();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Database reset to default settings.');
    });

    it('should handle internal errors during reset with default message', async () => {
      vi.spyOn(dbUtils, 'resetDb').mockImplementationOnce(() => {
        throw { message: '' };
      });

      const res = await postReset();
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  // 8. POST /api/seed
  describe('POST /api/seed', () => {
    it('should execute full seeding (scenarioId = null) successfully', async () => {
      const req = new Request('http://localhost/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: null })
      });

      const res = await postSeed(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Scenarios executed');
    });

    it('should parse body gracefully if invalid or missing', async () => {
      const req = new Request('http://localhost/api/seed', {
        method: 'POST',
        body: 'invalid-json'
      });

      const res = await postSeed(req);
      expect(res.status).toBe(200);
    });

    it('should execute specific scenario 1 successfully', async () => {
      const req = new Request('http://localhost/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: 1 })
      });
      const res = await postSeed(req);
      expect(res.status).toBe(200);
    });

    it('should execute specific scenario 2 with status 500 (policy denial)', async () => {
      const req = new Request('http://localhost/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: 2 })
      });
      const res = await postSeed(req);
      expect(res.status).toBe(500);
    });

    it('should execute specific scenario 3 with status 500 (policy denial)', async () => {
      const req = new Request('http://localhost/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: 3 })
      });
      const res = await postSeed(req);
      expect(res.status).toBe(500);
    });

    it('should execute specific scenario 4 with status 500 (policy denial)', async () => {
      const req = new Request('http://localhost/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: 4 })
      });
      const res = await postSeed(req);
      expect(res.status).toBe(500);
    });

    it('should fall back to default sandbox token during scenario run', async () => {
      delete process.env.T3N_SANDBOX_TOKEN;
      const req = new Request('http://localhost/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: 1 })
      });
      const res = await postSeed(req);
      expect(res.status).toBe(200);
    });

    it('should fall back to default sandbox token during full seed run', async () => {
      delete process.env.T3N_SANDBOX_TOKEN;
      const req = new Request('http://localhost/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: null })
      });
      const res = await postSeed(req);
      expect(res.status).toBe(200);
    });

    it('should handle unknown scenarioId gracefully', async () => {
      const req = new Request('http://localhost/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: 5 })
      });
      const res = await postSeed(req);
      expect(res.status).toBe(200);
    });

    it('should handle internal errors during seeding with default message', async () => {
      vi.spyOn(dbUtils, 'resetDb').mockImplementationOnce(() => {
        throw { message: '' };
      });

      const req = new Request('http://localhost/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: null })
      });

      const res = await postSeed(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});
