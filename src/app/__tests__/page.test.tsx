// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'font-geist-sans' }),
  Geist_Mono: () => ({ variable: 'font-geist-mono' }),
}));

import RootLayout, { metadata } from '../layout';
import WardixDashboard from '../page';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Wardix UI', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('RootLayout', () => {
    it('exposes metadata and renders', () => {
      expect(metadata.title).toBe('Wardix — IAM & Control Plane for Delegated AI Agents');
      expect(RootLayout({ children: 'child' })).toBeDefined();
    });
  });

  describe('WardixDashboard', () => {
    it('renders hero and all four scenarios', () => {
      render(<WardixDashboard />);
      expect(screen.getByText('Control Plane for Delegated AI Agents')).toBeTruthy();
      expect(screen.getByText('In-scope call')).toBeTruthy();
      expect(screen.getByText('Out-of-scope call')).toBeTruthy();
      expect(screen.getByText('Revoked grant')).toBeTruthy();
      expect(screen.getByText('Expired grant')).toBeTruthy();
      expect(screen.getByText('Run a scenario to see live verdicts.')).toBeTruthy();
    });

    it('shows a LIVE verdict + proof when the API returns one', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        jsonResponse({
          verdict: 'deny',
          reason: 'function_not_allowed: not a member of credential.functions',
          requestId: 'req-abc-123',
          node: 'https://cn-api.sg.testnet.t3n.terminal3.io',
          orgDid: 'did:t3n:abc',
          grantedFunctions: ['compute-payroll'],
          called: 'execute-disbursement',
        })
      );
      render(<WardixDashboard />);
      fireEvent.click(screen.getAllByText('Run')[1]); // out-of-scope card

      await waitFor(() => expect(screen.getAllByText('deny').length).toBeGreaterThan(0));
      expect(screen.getAllByText('LIVE').length).toBeGreaterThan(0);
      // proof panel shows the real request id
      expect(screen.getByText('req-abc-123')).toBeTruthy();
    });

    it('falls back to reference mode on 503 and shows the banner', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ error: 'disabled' }, 503));
      render(<WardixDashboard />);
      fireEvent.click(screen.getAllByText('Run')[0]); // in-scope card

      await waitFor(() => expect(screen.getByText(/Reference mode\./i)).toBeTruthy());
      expect(screen.getAllByText('ref').length).toBeGreaterThan(0);
      expect(screen.getAllByText('allow').length).toBeGreaterThan(0);
    });

    it('falls back to reference mode when the request throws', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
      render(<WardixDashboard />);
      fireEvent.click(screen.getAllByText('Run')[2]); // revoke card → expect deny

      await waitFor(() => expect(screen.getByText(/Reference mode\./i)).toBeTruthy());
      expect(screen.getAllByText('deny').length).toBeGreaterThan(0);
    });

    it('runs all scenarios via Run all', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        jsonResponse({ verdict: 'allow', reason: 'authorized by tee:delegation', requestId: 'r1' })
      );
      render(<WardixDashboard />);
      fireEvent.click(screen.getByText('Run all scenarios'));

      await waitFor(() => expect(screen.getAllByText('allow').length).toBeGreaterThan(1));
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });
});
