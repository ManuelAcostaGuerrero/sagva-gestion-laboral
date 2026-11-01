import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const matcherProject = path.join(projectRoot, 'tools', 'fingerprint-matcher', 'FingerprintMatcher.csproj');
const matcherDll = path.join(projectRoot, 'tools', 'fingerprint-matcher', 'bin', 'Debug', 'net8.0', 'FingerprintMatcher.dll');

export function matchFingerprint(probeTemplate, candidates) {
  return runMatcher({ probeTemplate, candidates });
}

export async function createEnrollmentTemplate(enrollmentTemplates) {
  const result = await runMatcher({ mode: 'enroll', enrollmentTemplates });
  if (!result.matched || !result.enrollmentTemplate) {
    throw new Error(result.error || 'No se pudo crear la plantilla de enrolamiento');
  }

  return result.enrollmentTemplate;
}

function runMatcher(payload) {
  return new Promise((resolve, reject) => {
    const args = existsSync(matcherDll)
      ? [matcherDll]
      : ['run', '--project', matcherProject];
    const sdkPaths = [
      'C:\\Program Files\\DigitalPersona\\U.are.U SDK\\Windows\\Lib\\x64',
      'C:\\Program Files\\DigitalPersona\\Bin',
      process.env.PATH || ''
    ];

    const child = spawn('dotnet', args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        PATH: sdkPaths.join(';')
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Comparador finalizo con codigo ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error('El comparador de huellas no devolvio JSON valido'));
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}
