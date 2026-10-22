// PostToolUse hook: lint the JS file Claude just edited and report errors back (exit 2).
const { execFileSync } = require('child_process');
const path = require('path');

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  const filePath = JSON.parse(input).tool_input?.file_path;
  if (!filePath || !/\.(js|jsx)$/.test(filePath)) return;

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const relative = path.relative(root, path.resolve(filePath));
  if (relative.startsWith('..') || relative.split(path.sep).includes('node_modules')) return;

  // backend/ has its own ESLint config and node_modules
  const inBackend = relative.split(path.sep)[0] === 'backend';
  const cwd = inBackend ? path.join(root, 'backend') : root;
  const eslint = path.join(cwd, 'node_modules', 'eslint', 'bin', 'eslint.js');

  try {
    execFileSync(process.execPath, [eslint, '--max-warnings', '0', path.relative(cwd, path.resolve(filePath))], { cwd, stdio: 'pipe' });
  } catch (err) {
    process.stderr.write(`ESLint errors in ${relative}:\n${err.stdout || ''}${err.stderr || ''}`);
    process.exit(2);
  }
});
