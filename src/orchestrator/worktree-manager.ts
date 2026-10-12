import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const execFile = promisify(execFileCallback);

export interface IsolatedWorktree {
  repositoryPath: string;
  worktreePath: string;
  runId: string;
  baseRef: string;
}

function isWithin(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}

function validateRunId(runId: string): void {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(runId)) {
    throw new Error('Invalid run id; use 1-80 letters, numbers, underscores, or hyphens');
  }
}

function validateRef(ref: string): void {
  if (!ref || ref.startsWith('-') || ref.includes('..') || !/^[A-Za-z0-9._/-]+$/.test(ref)) {
    throw new Error('Invalid git base ref');
  }
}

async function git(repositoryPath: string, args: string[]): Promise<string> {
  const result = await execFile('git', ['-C', repositoryPath, ...args], {
    timeout: 30000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  return result.stdout.trim();
}

/**
 * Create a detached Git worktree for a local, explicitly allow-listed repository.
 * Remote URLs and paths outside DEVORA_REPOSITORIES_DIR are intentionally rejected.
 */
export async function createIsolatedWorktree(repositoryPath: string, runId: string, baseRef = 'HEAD'): Promise<IsolatedWorktree> {
  validateRunId(runId);
  validateRef(baseRef);

  const configuredRepositories = process.env.DEVORA_REPOSITORIES_DIR;
  if (!configuredRepositories) throw new Error('DEVORA_REPOSITORIES_DIR must be configured before creating worktrees');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(repositoryPath)) throw new Error('Remote repository URLs are not accepted; configure a local repository path');

  const allowedRoot = await realpath(resolve(configuredRepositories));
  const requestedPath = resolve(repositoryPath);
  const repositoryRealPath = await realpath(requestedPath);
  if (!isWithin(allowedRoot, repositoryRealPath)) {
    throw new Error('Repository path is outside DEVORA_REPOSITORIES_DIR');
  }

  const repositoryTop = await git(repositoryRealPath, ['rev-parse', '--show-toplevel']);
  const canonicalTop = await realpath(repositoryTop);
  if (!isWithin(allowedRoot, canonicalTop)) throw new Error('Git repository resolves outside DEVORA_REPOSITORIES_DIR');
  await git(canonicalTop, ['rev-parse', '--verify', baseRef === 'HEAD' ? 'HEAD^{commit}' : `${baseRef}^{commit}`]);

  const worktreeRoot = resolve(process.env.DEVORA_WORKTREE_DIR || resolve(allowedRoot, '.devora-worktrees'));
  await mkdir(worktreeRoot, { recursive: true });
  const canonicalWorktreeRoot = await realpath(worktreeRoot);
  if (isWithin(allowedRoot, canonicalWorktreeRoot) && canonicalWorktreeRoot === canonicalTop) {
    throw new Error('Worktree directory cannot be the repository root');
  }
  const worktreePath = resolve(canonicalWorktreeRoot, runId);
  if (!isWithin(canonicalWorktreeRoot, worktreePath) || worktreePath === canonicalTop) {
    throw new Error('Resolved worktree path is unsafe');
  }

  await git(canonicalTop, ['worktree', 'add', '--detach', worktreePath, baseRef]);
  return { repositoryPath: canonicalTop, worktreePath, runId, baseRef };
}

/** Remove a worktree created by this manager; does not delete the source repository. */
export async function removeIsolatedWorktree(repositoryPath: string, runId: string): Promise<void> {
  validateRunId(runId);
  const configuredRepositories = process.env.DEVORA_REPOSITORIES_DIR;
  if (!configuredRepositories) throw new Error('DEVORA_REPOSITORIES_DIR must be configured before removing worktrees');
  const allowedRoot = await realpath(resolve(configuredRepositories));
  const repositoryRealPath = await realpath(resolve(repositoryPath));
  if (!isWithin(allowedRoot, repositoryRealPath)) throw new Error('Repository path is outside DEVORA_REPOSITORIES_DIR');

  const worktreeRoot = resolve(process.env.DEVORA_WORKTREE_DIR || resolve(allowedRoot, '.devora-worktrees'));
  const worktreePath = resolve(worktreeRoot, runId);
  if (!isWithin(worktreeRoot, worktreePath) || worktreePath === worktreeRoot) throw new Error('Resolved worktree path is unsafe');

  await git(repositoryRealPath, ['worktree', 'remove', '--force', worktreePath]);
  await git(repositoryRealPath, ['worktree', 'prune']);
}
