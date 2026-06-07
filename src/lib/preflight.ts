import { getDb } from './db';
import { evaluatePolicy, PolicyResult } from './policy';

export interface PreflightRequest {
  agentDid: string;
  fn: string;
  host?: string;
  amount?: number;
}

export function checkPreflight(req: PreflightRequest): PolicyResult {
  const db = getDb();
  return evaluatePolicy(db, req);
}
