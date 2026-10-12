# Superpowers: plan, test, review

Use this workflow for a code change that needs a clear scope, test plan and review.

## Usage

```
/superpowers-workflow describe the change and its constraints
```

## Workflow

1. Read the request and relevant code. Identify the intended behavior, constraints and unknowns. Ask about a consequential missing decision before changing code.
2. Write a short plan with files, behavior and verification. Keep unrelated changes out.
3. For a bug, write a test that fails for the original symptom. Implement a small fix, then run that test and the related suite.
4. Read the actual diff. Check requirements, failure paths and security boundaries. Keep generated changes in the worktree for human review.
5. Before claiming success, run the full applicable checks and read their output. Report what passed, what failed and what was not tested.

## Devora limits

This is a prompt workflow adapted from Superpowers planning, TDD, review and verification concepts. It does not install the Superpowers plugin or its agent-dispatch tooling. Devora's shell-free workspace worker can propose file edits, but cannot run tests or shell commands; provide commands for the operator and do not invent their results.

## Source and license

This Devora-format adaptation is based on https://github.com/obra/superpowers at commit `bb92a77741419a4ab5f06e711a283343f1ada0c3`. The upstream MIT notice is retained below.

```text
MIT License

Copyright (c) 2025 Jesse Vincent

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
