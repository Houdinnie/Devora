# Matt Pocock: behavior-first TDD

Use this workflow to define behavior and build one tested slice at a time.

## Usage

```
/matt-pocock-tdd describe the public behavior to add or fix
```

## Workflow

1. Read relevant code, project vocabulary and design decisions. Define the public interface where behavior will be observed.
2. Agree the important test boundaries with the owner. Explain what each test catches and what it does not cover.
3. Write one failing test for one behavior. Use an independently known expected result, not an assertion that repeats the implementation.
4. Make the smallest change to pass that test. Repeat for the next behavior rather than drafting all tests and implementation at once.
5. Keep tests at public interfaces. Avoid mocks of private collaborators that break when internals change.
6. Review the resulting design and diff. Report actual test results separately from proposed checks.

## Devora limits

Adapted from Matt Pocock's TDD skill. It is not the entire upstream collection and has no Claude-specific Skill-tool calls or missing reference-file dependencies. Devora can draft changes in an isolated worktree, not execute the red/green test loop itself. Ask the operator to run commands; an unrun test is a proposed test, not evidence.

## Source and license

This Devora-format adaptation is based on https://github.com/mattpocock/skills at commit `49dd158d1076134a641b33efb035946536778336`. The upstream MIT notice is retained below.

```text
MIT License

Copyright (c) 2026 Matt Pocock

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
