#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const option = process.argv[2];

if (!option) {
  console.error('Usage: node scripts/preview-ui-option.cjs <option>');
  console.error('Available options are the folder names in scripts/ui-options.');
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const optionRoot = path.join(__dirname, 'ui-options', option);

if (!fs.existsSync(optionRoot) || !fs.statSync(optionRoot).isDirectory()) {
  console.error(`Unknown UI option "${option}". Look in scripts/ui-options for available options.`);
  process.exit(1);
}

function run(command, opts = {}) {
  return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
}

function runInteractive(command) {
  execSync(command, { stdio: 'inherit' });
}

const status = run('git status --porcelain').trim();
if (status) {
  console.error('Please commit, stash, or discard your current changes before creating a preview branch.');
  process.exit(1);
}

const startingBranch = run('git rev-parse --abbrev-ref HEAD').trim();
const previewBranch = `preview/${option}`;

if (startingBranch === previewBranch) {
  console.error('You are already on the preview branch. Switch back to your working branch before running the script.');
  process.exit(1);
}

let branchExists = false;
try {
  run(`git show-ref --verify --quiet refs/heads/${previewBranch}`);
  branchExists = true;
} catch {
  branchExists = false;
}

let switchedBranch = false;

try {
  if (branchExists) {
    console.log(`Refreshing existing preview branch ${previewBranch} from ${startingBranch}...`);
    runInteractive(`git switch ${previewBranch}`);
    switchedBranch = true;
    runInteractive(`git reset --hard ${startingBranch}`);
  } else {
    console.log(`Creating preview branch ${previewBranch} from ${startingBranch}...`);
    runInteractive(`git switch -c ${previewBranch}`);
    switchedBranch = true;
  }

  const copyTree = (fromDir, toDir) => {
    const entries = fs.readdirSync(fromDir, { withFileTypes: true });
    for (const entry of entries) {
      const fromPath = path.join(fromDir, entry.name);
      const toPath = path.join(toDir, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(toPath, { recursive: true });
        copyTree(fromPath, toPath);
      } else if (entry.isFile()) {
        fs.mkdirSync(path.dirname(toPath), { recursive: true });
        fs.copyFileSync(fromPath, toPath);
      }
    }
  };

  copyTree(optionRoot, repoRoot);

  console.log();
  runInteractive('git status -sb');
  console.log();
  console.log(`Preview branch ${previewBranch} is ready.`);
  console.log('Run your dev server (e.g. npm run dev) to inspect the UI.');
  console.log(`When finished, switch back with: git switch ${startingBranch}`);
  console.log(`To remove the preview branch afterwards: git branch -D ${previewBranch}`);
} catch (error) {
  console.error();
  console.error('Failed to prepare the preview branch.');
  if (error.stdout) process.stdout.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  if (switchedBranch) {
    try {
      runInteractive(`git switch ${startingBranch}`);
    } catch {
      // ignore
    }
  }
  process.exit(1);
}
