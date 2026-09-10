import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const serial = process.argv[2];
if (!serial?.startsWith('emulator-')) {
  throw new Error('Pass an explicit emulator serial; this probe is emulator-only.');
}
const adb = (...args) => {
  const run = spawnSync('adb', ['-s', serial, ...args], {
    encoding: 'utf8', timeout: 30000,
  });
  if (run.error || run.status !== 0) {
    throw new Error(`adb probe failed: ${run.error?.message ?? run.stderr}`);
  }
  return run.stdout.trim();
};

const results = [];
for (const mode of ['readonly', 'writable', 'lifecycle']) {
  const faults = mode === 'lifecycle' ? ['valid', 'crc-flip']
    : ['valid', 'wrong-key', 'missing-key', 'data-flip', 'data-truncate', 'crc-flip', 'crc-truncate'];
  for (const fault of faults) {
    const raw = adb('shell', 'am', 'instrument', '-w', '-e', 'fault', fault,
      '-e', 'mode', mode, 'com.cogvest.encryptionprobe/.Probe');
    const json = raw.split(/\r?\n/).find(line => line.startsWith('{'));
    const result = json ? JSON.parse(json) : { mode, fault, probeError: raw };
    results.push(result);
    console.log(`${mode} ${fault}: ${json
      ? `data unchanged=${result.dataUnchanged}, CRC unchanged=${result.crcUnchanged}, sentinel=${result.sentinelMatches}, portfolio=${result.portfolioMatches}`
      : 'PROBE ERROR'}`);
  }
}
const report = {
  capturedAt: new Date().toISOString(), serial,
  model: adb('shell', 'getprop', 'ro.product.model'),
  api: adb('shell', 'getprop', 'ro.build.version.sdk'),
  abi: adb('shell', 'getprop', 'ro.product.cpu.abi'), results,
};
const directory = resolve('.expo/encryption-probe');
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, 'results.json'), JSON.stringify(report, null, 2) + '\n');
// Passing this lower-level probe is not approval for production integration.
const failed = results.some(result => result.probeError || !result.dataUnchanged
  || !result.crcUnchanged || !result.plaintextMarkerAbsent
  || (result.fault === 'valid' && (!result.sentinelMatches || !result.portfolioMatches)));
console.log(failed ? 'BLOCKED: native safety gate has failures.' : 'Native screening passed; RN/SecureStore integration is still unverified.');
process.exitCode = failed ? 1 : 0;
