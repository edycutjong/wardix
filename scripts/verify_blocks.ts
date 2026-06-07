import fs from 'fs';
import path from 'path';
import { T3nClient, createEthAuthInput } from '../src/lib/t3n';
import { resetDb } from '../src/lib/db';

// Load env.local for local execution context
try {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.trim().startsWith('T3N_SANDBOX_TOKEN=')) {
        process.env.T3N_SANDBOX_TOKEN = line.trim().split('=', 2)[1].trim();
      }
    }
  }
} catch {}

async function verifyBlocks() {
  console.log('🧪 Running Wardix Security Integrity Verification...');
  resetDb();

  const client = new T3nClient();
  await client.handshake();
  await client.authenticate(createEthAuthInput('0xVerifierAddress'));

  let failures = 0;

  // Scenario 1 Verification
  try {
    const res = await client.execute({
      script_name: 'tee:user/contracts',
      function_name: 'transfer',
      input: { agentDid: 'did:t3n:payments', host: 'vendorA', amount: 250 }
    });
    if (res.verdict.verdict === 'allow') {
      console.log('✅ Scenario 1: Legitimate $250 transfer ALLOWED (Pass)');
    } else {
      console.error('❌ Scenario 1: Expected ALLOW but got DENY');
      failures++;
    }
  } catch (err: any) {
    console.error('❌ Scenario 1: Threw unexpected error:', err.message);
    failures++;
  }

  // Scenario 2 Verification
  try {
    await client.execute({
      script_name: 'tee:user/contracts',
      function_name: 'transfer',
      input: { agentDid: 'did:t3n:data', host: 'x', amount: 50 }
    });
    console.error('❌ Scenario 2: Expected DENY but got ALLOW');
    failures++;
  } catch (err: any) {
    const reason = err.verdict?.reason || err.message;
    if (err.code === 'host/http.egress_denied' && reason.includes("outside scope: data-agent can't transfer")) {
      console.log('✅ Scenario 2: Data-agent transfer function DENIED natively (Pass)');
    } else {
      console.error('❌ Scenario 2: Incorrect deny reason or code. Got:', reason);
      failures++;
    }
  }

  // Scenario 3 Verification
  try {
    await client.execute({
      script_name: 'tee:user/contracts',
      function_name: 'transfer',
      input: { agentDid: 'did:t3n:impostor', host: 'attacker', amount: 40000 }
    });
    console.error('❌ Scenario 3: Expected DENY but got ALLOW');
    failures++;
  } catch (err: any) {
    const reason = err.verdict?.reason || err.message;
    if (err.code === 'host/http.egress_denied' && reason.includes('unregistered identity')) {
      console.log('✅ Scenario 3: Unregistered impostor identity DENIED natively (Pass)');
    } else {
      console.error('❌ Scenario 3: Incorrect deny reason or code. Got:', reason);
      failures++;
    }
  }

  // Scenario 4 Verification
  try {
    await client.execute({
      script_name: 'tee:user/contracts',
      function_name: 'transfer',
      input: { agentDid: 'did:t3n:payments', host: 'attacker', amount: 40000 }
    });
    console.error('❌ Scenario 4: Expected DENY but got ALLOW');
    failures++;
  } catch (err: any) {
    const reason = err.verdict?.reason || err.message;
    if (err.code === 'host/http.egress_denied' && reason.includes('host not allowlisted')) {
      console.log('✅ Scenario 4: Injected payments transfer to attacker host DENIED natively (Pass)');
    } else {
      console.error('❌ Scenario 4: Incorrect deny reason or code. Got:', reason);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`\n❌ Integrity verification failed with ${failures} errors.`);
    process.exit(1);
  } else {
    console.log('\n🌟 Security integrity verification passed! All native blocks verified.');
    process.exit(0);
  }
}

verifyBlocks().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
