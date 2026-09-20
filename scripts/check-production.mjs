import { existsSync } from 'node:fs';
import { productionConfigErrors, checkHostedServices } from './production-config.mjs';

// Never load the old development configuration silently for a launch.
if (existsSync('.env.production.local')) process.loadEnvFile('.env.production.local');
const errors = productionConfigErrors(process.env);
if (errors.length) {
  for (const error of errors) console.error('NOT READY: ' + error);
  process.exitCode = 1;
} else if (process.argv.includes('--offline')) {
  console.log('Production configuration is valid. Hosted services have not been tested.');
} else {
  const checks = await checkHostedServices(process.env);
  for (const check of checks) console.log((check.ok ? 'PASS: ' : 'NOT READY: ') + check.name);
  process.exitCode = checks.every(check => check.ok) ? 0 : 1;
  console.log('Also verify real confirmation/reset email delivery, uploads, backup recovery and the owner-approved privacy/operating policies before inviting users.');
}
