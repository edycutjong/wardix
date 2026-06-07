import { T3nClient, createEthAuthInput } from '../src/lib/t3n';
import { resetDb, getDb } from '../src/lib/db';

async function runSeed() {
  console.log('🌱 Starting Wardix scenario seeding...');

  // Reset db
  resetDb();
  console.log('🧹 Database reset to initial state.');

  const client = new T3nClient({
    nodeUrl: 'http://localhost:3000',
    privateKey: 'test-sandbox-token-00000000000000000000000000000'
  });

  await client.handshake();
  await client.authenticate(createEthAuthInput('0xWardixAdminAddress'));
  console.log('🔒 Secure TEE handshake & auth completed.');

  console.log('\n--- Scenario 1: Legitimate payments-agent transfer ($250 to vendorA) ---');
  try {
    const res = await client.execute({
      script_name: 'tee:user/contracts',
      function_name: 'transfer',
      input: { agentDid: 'did:t3n:payments', host: 'vendorA', amount: 250 }
    });
    console.log('✅ Scenario 1 Verdict: ALLOWED');
    console.log('   Attestation:', res.verdict.attestation);
  } catch (err: any) {
    console.log('❌ Scenario 1 Verdict: DENIED unexpectedly:', err.message);
  }

  console.log('\n--- Scenario 2: Data-agent transfer ($50 to x) ---');
  try {
    await client.execute({
      script_name: 'tee:user/contracts',
      function_name: 'transfer',
      input: { agentDid: 'did:t3n:data', host: 'x', amount: 50 }
    });
    console.log('✅ Scenario 2 Verdict: ALLOWED unexpectedly');
  } catch (err: any) {
    console.log('❌ Scenario 2 Verdict: DENIED (Expected)');
    console.log('   Code:', err.code);
    console.log('   Reason:', err.message);
    console.log('   Attestation:', err.verdict?.attestation);
  }

  console.log('\n--- Scenario 3: Unregistered impostor-agent transfer ($40k to attacker) ---');
  try {
    await client.execute({
      script_name: 'tee:user/contracts',
      function_name: 'transfer',
      input: { agentDid: 'did:t3n:impostor', host: 'attacker', amount: 40000 }
    });
    console.log('✅ Scenario 3 Verdict: ALLOWED unexpectedly');
  } catch (err: any) {
    console.log('❌ Scenario 3 Verdict: DENIED (Expected)');
    console.log('   Code:', err.code);
    console.log('   Reason:', err.message);
    console.log('   Attestation:', err.verdict?.attestation);
  }

  console.log('\n--- Scenario 4: Prompt-injected payments-agent transfer ($40k to attacker) ---');
  try {
    await client.execute({
      script_name: 'tee:user/contracts',
      function_name: 'transfer',
      input: { agentDid: 'did:t3n:payments', host: 'attacker', amount: 40000 }
    });
    console.log('✅ Scenario 4 Verdict: ALLOWED unexpectedly');
  } catch (err: any) {
    console.log('❌ Scenario 4 Verdict: DENIED (Expected)');
    console.log('   Code:', err.code);
    console.log('   Reason:', err.message);
    console.log('   Attestation:', err.verdict?.attestation);
  }

  console.log('\n✨ Seeding completed. Decisions log updated.');
  const db = getDb();
  console.log(`📊 Current decisions recorded: ${db.decisions.length}`);
}

runSeed().catch(console.error);
