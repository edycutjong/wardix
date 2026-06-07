import { T3nClient, createEthAuthInput } from '../src/lib/t3n';
import { resetDb } from '../src/lib/db';

async function runBenchmarkHelper() {
  resetDb();
  
  const client = new T3nClient();
  await client.handshake();
  await client.authenticate(createEthAuthInput('0xBenchAddress'));

  const scenarios = [
    { agentDid: 'did:t3n:payments', host: 'vendorA', amount: 250, fn: 'transfer' }, // allow
    { agentDid: 'did:t3n:data', host: 'x', amount: 50, fn: 'transfer' }, // deny
    { agentDid: 'did:t3n:impostor', host: 'attacker', amount: 40000, fn: 'transfer' }, // deny
    { agentDid: 'did:t3n:payments', host: 'attacker', amount: 40000, fn: 'transfer' } // deny
  ];

  const latencies: number[] = [];

  // Run 200 adjudications
  for (let i = 0; i < 200; i++) {
    const scenario = scenarios[i % scenarios.length];
    
    const start = process.hrtime.bigint();
    try {
      await client.execute({
        script_name: 'tee:user/contracts',
        function_name: scenario.fn,
        input: { agentDid: scenario.agentDid, host: scenario.host, amount: scenario.amount }
      });
    } catch {
      // Denials throw an error, which is part of the execution flow
    }
    const end = process.hrtime.bigint();
    
    // Duration in milliseconds (floating-point)
    const durationMs = Number(end - start) / 1_000_000;
    latencies.push(durationMs);
  }

  // Output JSON to stdout
  console.log(JSON.stringify(latencies));
}

runBenchmarkHelper().catch(err => {
  console.error(err);
  process.exit(1);
});
