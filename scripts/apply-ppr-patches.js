const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.env.ENABLE_PPR !== 'true') {
  console.log('[PPR] ENABLE_PPR not set — skipping PPR patches.');
  process.exit(0);
}

console.log('[PPR] ENABLE_PPR=true — applying PPR npm patches...');

const projectRoot = path.join(__dirname, '..');
const patchDir = path.join(projectRoot, 'patches', 'ppr');

if (!fs.existsSync(patchDir)) {
  console.error('[PPR] patches/ppr/ directory not found');
  process.exit(1);
}

const patches = fs.readdirSync(patchDir).filter(f => f.endsWith('.patch'));
if (patches.length === 0) {
  console.log('[PPR] No .patch files found in patches/ppr/');
  process.exit(0);
}

let failed = false;
for (const patchFile of patches) {
  const patchPath = path.join(patchDir, patchFile);
  const content = fs.readFileSync(patchPath, 'utf8');

  const usesNodeModulesPath = content.includes('a/node_modules/') || content.includes('b/node_modules/');

  let cmd;
  if (usesNodeModulesPath) {
    cmd = `patch -p1 -N --no-backup-if-mismatch -d "${projectRoot}" < "${patchPath}"`;
  } else {
    const match = patchFile.match(/^(.+?)[@+](.+)\.patch$/);
    if (!match) {
      console.warn(`[PPR] Skipping unrecognized patch filename: ${patchFile}`);
      continue;
    }
    const pkgName = match[1];
    const pkgDir = path.join(projectRoot, 'node_modules', pkgName);
    if (!fs.existsSync(pkgDir)) {
      console.warn(`[PPR] Package not found: ${pkgDir}, skipping ${patchFile}`);
      continue;
    }
    cmd = `patch -p1 -N --no-backup-if-mismatch -d "${pkgDir}" < "${patchPath}"`;
  }

  try {
    execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`[PPR] Applied: ${patchFile}`);
  } catch (e) {
    const output = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
    if (output.includes('Reversed') || output.includes('already applied') || output.includes('previously applied') || output.includes('Skipping')) {
      console.log(`[PPR] Already applied: ${patchFile}`);
    } else {
      console.error(`[PPR] FAILED to apply ${patchFile}:`, output || e.message);
      failed = true;
    }
  }
}

if (failed) {
  console.error('[PPR] Some patches failed. PPR may not work correctly.');
  process.exit(1);
}

console.log('[PPR] All npm patches applied successfully.');
