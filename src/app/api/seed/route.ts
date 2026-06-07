import { NextResponse } from 'next/server';
import { T3nClient, createEthAuthInput } from '@/lib/t3n';
import { resetDb } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { scenarioId } = await request.json().catch(() => ({ scenarioId: null }));

    if (scenarioId === null) {
      // Full seed: reset first, then run all scenarios
      resetDb();

      const client = new T3nClient({
        sandboxToken: process.env.T3N_SANDBOX_TOKEN || 'test-sandbox-token-00000000000000000000000000000'
      });
      await client.handshake();
      await client.authenticate(createEthAuthInput('0xAgentSystem'));

      // Scenario 1: payments-agent transfer $250 to vendorA (should allow)
      try {
        await client.execute({
          script_name: 'tee:user/contracts',
          function_name: 'transfer',
          input: { agentDid: 'did:t3n:payments', host: 'vendorA', amount: 250 }
        });
      } catch {
        // Expected to succeed
      }

      // Scenario 2: data-agent transfer $50 to x (should deny)
      try {
        await client.execute({
          script_name: 'tee:user/contracts',
          function_name: 'transfer',
          input: { agentDid: 'did:t3n:data', host: 'x', amount: 50 }
        });
      } catch {
        // Expected to fail
      }

      // Scenario 3: impostor transfer $40k to attacker (should deny)
      try {
        await client.execute({
          script_name: 'tee:user/contracts',
          function_name: 'transfer',
          input: { agentDid: 'did:t3n:impostor', host: 'attacker', amount: 40000 }
        });
      } catch {
        // Expected to fail
      }

      // Scenario 4: payments-agent prompt-injected transfer $40k to attacker (should deny)
      try {
        await client.execute({
          script_name: 'tee:user/contracts',
          function_name: 'transfer',
          input: { agentDid: 'did:t3n:payments', host: 'attacker', amount: 40000 }
        });
      } catch {
        // Expected to fail
      }
    } else {
      // Trigger a single scenario specifically
      const client = new T3nClient({
        sandboxToken: process.env.T3N_SANDBOX_TOKEN || 'test-sandbox-token-00000000000000000000000000000'
      });
      await client.handshake();
      await client.authenticate(createEthAuthInput('0xAgentSystem'));

      if (scenarioId === 1) {
        await client.execute({
          script_name: 'tee:user/contracts',
          function_name: 'transfer',
          input: { agentDid: 'did:t3n:payments', host: 'vendorA', amount: 250 }
        });
      } else if (scenarioId === 2) {
        await client.execute({
          script_name: 'tee:user/contracts',
          function_name: 'transfer',
          input: { agentDid: 'did:t3n:data', host: 'x', amount: 50 }
        });
      } else if (scenarioId === 3) {
        await client.execute({
          script_name: 'tee:user/contracts',
          function_name: 'transfer',
          input: { agentDid: 'did:t3n:impostor', host: 'attacker', amount: 40000 }
        });
      } else if (scenarioId === 4) {
        await client.execute({
          script_name: 'tee:user/contracts',
          function_name: 'transfer',
          input: { agentDid: 'did:t3n:payments', host: 'attacker', amount: 40000 }
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Scenarios executed' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
