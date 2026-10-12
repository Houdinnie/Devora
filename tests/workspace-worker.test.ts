import { mkdtemp, readFile, rm, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyWorkspaceChanges } from '../src/orchestrator/workspace-worker.js';

describe('isolated workspace worker', () => {
  let root = '';
  let outside = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'devora-workspace-'));
    outside = await mkdtemp(join(tmpdir(), 'devora-workspace-outside-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });

  it('applies structured edits only inside the worktree', async () => {
    const result = await applyWorkspaceChanges(root, JSON.stringify({
      summary: 'Add a greeting',
      files: [{ path: 'src/greeting.ts', content: 'export const greeting = "hello";\n' }],
    }));
    expect(result.summary).toBe('Add a greeting');
    expect(result.changedFiles).toEqual(['src/greeting.ts']);
    expect(await readFile(join(root, 'src/greeting.ts'), 'utf8')).toContain('"hello"');
  });

  it('rejects traversal, secrets, and non-JSON model responses', async () => {
    await expect(applyWorkspaceChanges(root, JSON.stringify({
      summary: 'escape', files: [{ path: '../outside.txt', content: 'nope' }],
    }))).rejects.toThrow('unsafe segment');
    await expect(applyWorkspaceChanges(root, JSON.stringify({
      summary: 'secret', files: [{ path: '.env', content: 'API_KEY=bad' }],
    }))).rejects.toThrow('protected file');
    await expect(applyWorkspaceChanges(root, 'Here are the changes')).rejects.toThrow('valid JSON');
  });

  it('refuses edits through symlinked directories', async () => {
    await symlink(outside, join(root, 'linked'), 'dir');
    await expect(applyWorkspaceChanges(root, JSON.stringify({
      summary: 'escape through symlink', files: [{ path: 'linked/evil.txt', content: 'nope' }],
    }))).rejects.toThrow('Unsafe parent path');
    await expect(readFile(join(outside, 'evil.txt'), 'utf8')).rejects.toThrow();
  });
});
