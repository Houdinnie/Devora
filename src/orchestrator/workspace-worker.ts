import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const execFile = promisify(execFileCallback);
const MAX_CONTEXT_FILES = 50;
const MAX_CONTEXT_CHARS = 48000;
const MAX_PATCH_FILES = 20;
const MAX_FILE_CHARS = 100000;
const MAX_PATCH_CHARS = 500000;

function isWithin(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}

function isProtectedPath(filePath: string): boolean {
  const parts = filePath.split('/');
  const name = parts[parts.length - 1].toLowerCase();
  if (parts.includes('.git') || parts.includes('node_modules') || parts.includes('.ssh') || parts.includes('.aws')) return true;
  if (/^\.env(?:\.|$)/i.test(name) && name !== '.env.example') return true;
  if (/^(\.npmrc|\.pypirc|\.netrc|\.git-credentials|credentials?(\..*)?|secrets?(\..*)?|id_rsa(\..*)?|id_ed25519(\..*)?)$/i.test(name)) return true;
  if (/\.(pem|key|p12|pfx|crt|cer|der|keystore|jks)$/i.test(name)) return true;
  return false;
}

function safeRelativePath(filePath: string): string {
  if (!filePath || filePath.includes('\0') || isAbsolute(filePath) || filePath.startsWith('/') || filePath.includes('\\')) {
    throw new Error('Workspace edit path must be a relative POSIX path');
  }
  const parts = filePath.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw new Error('Workspace edit path contains an unsafe segment');
  if (isProtectedPath(filePath)) throw new Error('Workspace edit path targets a protected file or directory');
  return parts.join('/');
}

export async function buildWorkspaceContext(worktreePath: string): Promise<{ files: Array<{ path: string; content: string }>; truncated: boolean }> {
  const root = await realpath(worktreePath);
  const result = await execFile('git', ['-C', root, 'ls-files', '-co', '--exclude-standard'], {
    timeout: 15000, maxBuffer: 2 * 1024 * 1024, windowsHide: true,
  });
  const paths = result.stdout.split('\n').map(s => s.trim()).filter(Boolean)
    .filter(p => !p.startsWith('.git/') && !p.includes('/node_modules/') && !/^node_modules\//.test(p) && !isProtectedPath(p));
  const priority = (p: string) => p === 'package.json' ? 0 : p === 'README.md' ? 1 : p === 'tsconfig.json' ? 2 : p.startsWith('src/') ? 3 : 4;
  paths.sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));
  const files: Array<{ path: string; content: string }> = [];
  let used = 0;
  let truncated = false;
  for (const path of paths) {
    if (files.length >= MAX_CONTEXT_FILES || used >= MAX_CONTEXT_CHARS) { truncated = true; break; }
    const absolute = resolve(root, path);
    if (!isWithin(root, absolute)) continue;
    try {
      const stat = await lstat(absolute);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16000) continue;
      const content = await readFile(absolute, 'utf8');
      const remaining = MAX_CONTEXT_CHARS - used;
      const clipped = content.length > remaining ? content.slice(0, remaining) : content;
      files.push({ path, content: clipped });
      used += clipped.length;
      if (clipped.length !== content.length) { truncated = true; break; }
    } catch { /* unreadable files are omitted from prompt context */ }
  }
  return { files, truncated };
}

export async function applyWorkspaceChanges(worktreePath: string, rawOutput: string): Promise<{ summary: string; changedFiles: string[] }> {
  const root = await realpath(worktreePath);
  const normalized = rawOutput.trim().replace(/^\x60{3}(?:json)?\s*/i, '').replace(/\s*\x60{3}$/i, '');
  let parsed: unknown;
  try { parsed = JSON.parse(normalized); } catch { throw new Error('Coding agent must return valid JSON: an object with summary and files'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid coding-agent response');
  const response = parsed as { summary?: unknown; files?: unknown };
  if (typeof response.summary !== 'string' || !Array.isArray(response.files)) throw new Error('Coding-agent response requires a summary and files array');
  if (response.files.length > MAX_PATCH_FILES) throw new Error(`A single step may edit at most ${MAX_PATCH_FILES} files`);
  let total = 0;
  const changedFiles: string[] = [];
  for (const entry of response.files) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Each file edit must contain path and content');
    const edit = entry as { path?: unknown; content?: unknown };
    if (typeof edit.path !== 'string' || typeof edit.content !== 'string') throw new Error('Each file edit must contain string path and content');
    const path = safeRelativePath(edit.path);
    if (edit.content.length > MAX_FILE_CHARS) throw new Error(`File edit exceeds ${MAX_FILE_CHARS} characters: ${path}`);
    total += edit.content.length;
    if (total > MAX_PATCH_CHARS) throw new Error('Total workspace edits exceed the allowed size');
    const target = resolve(root, path);
    if (!isWithin(root, target) || target === root) throw new Error('Workspace edit resolves outside the worktree');

    const parts = path.split('/');
    let parent = root;
    for (const part of parts.slice(0, -1)) {
      parent = join(parent, part);
      try {
        const info = await lstat(parent);
        if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`Unsafe parent path: ${path}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        await mkdir(parent);
      }
    }
    const canonicalParent = await realpath(join(root, ...parts.slice(0, -1)));
    if (!isWithin(root, canonicalParent)) throw new Error('Workspace edit parent resolves outside the worktree');
    try {
      const info = await lstat(target);
      if (info.isSymbolicLink() || !info.isFile()) throw new Error(`Refusing to overwrite a non-regular file: ${path}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await writeFile(target, edit.content, { encoding: 'utf8', flag: 'w' });
    changedFiles.push(path);
  }
  return { summary: response.summary.slice(0, 4000), changedFiles };
}
