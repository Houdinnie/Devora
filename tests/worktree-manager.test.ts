import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIsolatedWorktree } from '../src/orchestrator/worktree-manager.js';

describe('isolated worktree safety', () => {
  let root = '';
  let outside = '';
  let previousRoot: string | undefined;
  let previousWorktree: string | undefined;

  beforeEach(async () => {
    previousRoot = process.env.DEVORA_REPOSITORIES_DIR;
    previousWorktree = process.env.DEVORA_WORKTREE_DIR;
    root = await mkdtemp(join(tmpdir(), 'devora-repos-'));
    outside = await mkdtemp(join(tmpdir(), 'devora-outside-'));
    process.env.DEVORA_REPOSITORIES_DIR = root;
    process.env.DEVORA_WORKTREE_DIR = join(root, '.worktrees');
  });

  afterEach(async () => {
    if (previousRoot === undefined) delete process.env.DEVORA_REPOSITORIES_DIR;
    else process.env.DEVORA_REPOSITORIES_DIR = previousRoot;
    if (previousWorktree === undefined) delete process.env.DEVORA_WORKTREE_DIR;
    else process.env.DEVORA_WORKTREE_DIR = previousWorktree;
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });

  it('rejects malformed run ids and unsafe refs', async () => {
    await expect(createIsolatedWorktree(join(root, 'repo'), '../escape')).rejects.toThrow('Invalid run id');
    await expect(createIsolatedWorktree(join(root, 'repo'), 'run-1', '--upload-pack')).rejects.toThrow('Invalid git base ref');
  });

  it('rejects remote URLs instead of implicitly cloning arbitrary repositories', async () => {
    await expect(createIsolatedWorktree('https://example.com/attacker/repo.git', 'run-1')).rejects.toThrow('Remote repository URLs are not accepted');
  });

  it('rejects local paths outside the configured repository allow-list', async () => {
    const outsideRepo = join(outside, 'repo');
    await mkdir(outsideRepo);
    await expect(createIsolatedWorktree(outsideRepo, 'run-2')).rejects.toThrow('outside DEVORA_REPOSITORIES_DIR');
  });
});
