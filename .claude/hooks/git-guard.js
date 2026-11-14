#!/usr/bin/env node
// PreToolUse hook (Claude Code): blocks git/gh commands that break this repo's gitflow rules.
// Reads the tool call as JSON on stdin; exit 2 + stderr = command refused (the reason is shown to the agent).
// Rules: see .claude/CLAUDE.md.
'use strict';
const { execFileSync } = require('child_process');

const PROTECTED = new Set(['main', 'develop']);
const NAME = '[a-z0-9][a-z0-9._-]*';
const VALID = new RegExp(`^(feature|fix|hotfix)/${NAME}$`);
const DOCS = 'See .claude/CLAUDE.md (Git workflow). If you really need this, ask a human maintainer.';

function deny(msg) {
  process.stderr.write(`⛔ Blocked by gitflow guard: ${msg}\n${DOCS}\n`);
  process.exit(2);
}

function tokenize(segment) {
  return (segment.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, ''));
}

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const strip = (ref) => (ref || '').replace(/^refs\/heads\//, '').replace(/^(origin|upstream)\//, '');
const exe = (t) => t.replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase();

function checkNewBranch(name, start, cur) {
  if (!VALID.test(name)) deny(`branch "${name}" must be named feature/<name>, fix/<name> or hotfix/<name> (lowercase kebab-case).`);
  const base = strip(start === undefined || start === 'HEAD' ? cur : start);
  const need = name.startsWith('hotfix/') ? 'main' : 'develop';
  if (base !== need) deny(`"${name}" must be created from ${need} (got "${base || 'unknown'}"). Run: git switch ${need} && git pull --ff-only && git switch -c ${name}`);
}

function checkGit(args, cwd) {
  // skip global options (git -C <path> -c k=v …)
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) {
    if (args[i] === '-C') cwd = args[i + 1] || cwd;
    if (args[i] === '-C' || args[i] === '-c') i++;
    i++;
  }
  const sub = args[i];
  const rest = args.slice(i + 1);
  const flags = rest.filter((a) => a.startsWith('-'));
  const pos = rest.filter((a) => !a.startsWith('-'));
  if (!sub) return;
  const cur = currentBranch(cwd);
  const onProtected = PROTECTED.has(cur);
  const has = (...f) => flags.some((x) => f.includes(x) || f.some((y) => y.startsWith('--') && x.startsWith(y + '=')));

  if (flags.includes('--no-verify')) deny('--no-verify is not allowed.');

  switch (sub) {
    case 'commit':
      if (onProtected) deny(`you are on "${cur}". Never commit on main/develop — create a feature/, fix/ or hotfix/ branch.`);
      break;
    case 'merge':
    case 'cherry-pick':
    case 'rebase':
    case 'revert':
    case 'am':
      if (onProtected && !has('--abort', '--quit', '--skip')) deny(`"git ${sub}" on "${cur}" is not allowed — changes reach main/develop only through pull requests.`);
      break;
    case 'push': {
      if (has('--mirror', '--all')) deny('push --mirror/--all is not allowed.');
      const force = has('--force', '-f', '--force-with-lease', '--force-if-includes');
      const del = has('--delete', '-d');
      const refspecs = pos.slice(1);
      const targets = refspecs.length ? refspecs : [cur];
      for (const spec of targets) {
        if (spec.startsWith('refs/tags/') || /^v\d/.test(spec)) continue; // tags are fine
        const isForce = force || spec.startsWith('+');
        const dst = strip(spec.replace(/^\+/, '').split(':').pop() || spec.split(':')[0]);
        const target = dst === 'HEAD' ? cur : dst;
        const deleting = del || spec.startsWith(':');
        if (PROTECTED.has(target)) deny(`pushing to "${target}"${isForce ? ' (forced)' : ''}${deleting ? ' (delete)' : ''} is not allowed — open a pull request instead.`);
        if (!deleting && target && !VALID.test(target)) deny(`"${target}" is not a valid branch name (feature/, fix/ or hotfix/).`);
      }
      break;
    }
    case 'branch': {
      const listing = has('--list', '-l', '-a', '-r', '-v', '-vv', '--show-current', '--contains', '--merged', '--no-merged', '-u', '--set-upstream-to', '--unset-upstream', '--edit-description');
      if (has('-d', '-D', '--delete')) {
        for (const b of pos) if (PROTECTED.has(strip(b))) deny(`deleting "${b}" is not allowed.`);
        break;
      }
      if (has('-m', '-M', '--move', '-c', '-C', '--copy')) {
        const target = pos[pos.length - 1];
        const source = pos.length === 2 ? pos[0] : cur;
        if (PROTECTED.has(source) || PROTECTED.has(target)) deny(`renaming or copying over "${PROTECTED.has(source) ? source : target}" is not allowed.`);
        if (target && !VALID.test(target)) deny(`"${target}" is not a valid branch name.`);
        break;
      }
      if (listing || pos.length === 0) break;
      if (has('-f', '--force') && PROTECTED.has(pos[0])) deny(`resetting "${pos[0]}" with branch -f is not allowed.`);
      checkNewBranch(pos[0], pos[1], cur);
      break;
    }
    case 'checkout':
    case 'switch': {
      const idx = rest.findIndex((a) => ['-b', '-B', '-c', '-C', '--create', '--force-create'].includes(a));
      if (idx === -1) break;
      const after = rest.slice(idx + 1).filter((a) => !a.startsWith('-'));
      if (after[0]) checkNewBranch(after[0], after[1], cur);
      break;
    }
    case 'worktree':
      if (pos[0] === 'add') {
        const idx = rest.findIndex((a) => a === '-b' || a === '-B');
        if (idx !== -1) {
          const after = rest.slice(idx + 1).filter((a) => !a.startsWith('-'));
          checkNewBranch(after[0], after[2], cur);
        }
      }
      break;
  }
}

function opt(args, short, long) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === short || args[i] === long) return args[i + 1];
    if (args[i].startsWith(long + '=')) return args[i].slice(long.length + 1);
  }
  return undefined;
}

function checkGh(args, cwd) {
  const [a, b] = args;
  if (a === 'pr' && b === 'create') {
    const base = strip(opt(args, '-B', '--base') || 'develop'); // repo default branch is develop
    const head = strip(opt(args, '-H', '--head') || currentBranch(cwd));
    const ok =
      base === 'main' ? head === 'develop' || /^hotfix\//.test(head) && VALID.test(head)
      : base === 'develop' ? head === 'main' || /^(feature|fix)\//.test(head) && VALID.test(head)
      : VALID.test(head);
    if (!ok) deny(`a PR from "${head}" into "${base}" is not allowed. main ← develop | hotfix/*; develop ← feature/* | fix/* | main (backport).`);
  }
  if (a === 'pr' && b === 'merge' && args.includes('--admin')) deny('gh pr merge --admin bypasses the repository rules.');
  if (a === 'repo' && b === 'edit') deny('changing repository settings is reserved to human maintainers.');
  if (a === 'ruleset' && b && !['list', 'view', 'check', 'ls'].includes(b)) deny('changing rulesets is reserved to human maintainers.');
  if (a === 'api') {
    const method = (opt(args, '-X', '--method') || '').toUpperCase();
    const writes = method && method !== 'GET' || args.some((x) => /^(-f|-F|--field|--raw-field|--input)$/.test(x));
    const path = args.find((x, i) => i > 0 && !x.startsWith('-') && /\//.test(x)) || '';
    if (writes && /(rulesets|\/protection|\/branches\/|actions\/permissions|\/hooks)(\/|$|\?)|^\/?repos\/[^/]+\/[^/]+\/?$/.test(path)) {
      deny(`"gh api ${method || 'POST'} ${path}" would change repository rules or settings — reserved to human maintainers.`);
    }
  }
}

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const cmd = input?.tool_input?.command;
  if (typeof cmd !== 'string' || !/\b(git|gh)(\.exe)?\b/i.test(cmd)) process.exit(0);
  const cwd = input.cwd || process.cwd();
  for (const segment of cmd.split(/&&|\|\||[;|\n]/)) {
    const toks = tokenize(segment).filter((t) => t !== '&');
    const k = toks.findIndex((t) => ['git', 'gh'].includes(exe(t)));
    if (k === -1) continue;
    const args = toks.slice(k + 1);
    if (exe(toks[k]) === 'git') checkGit(args, cwd);
    else checkGh(args, cwd);
  }
  process.exit(0);
});
