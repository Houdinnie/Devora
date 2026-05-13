# Run Commands

Execute shell commands and terminal operations.

## Usage
```
/run-commands "npm install && npm run build"
/run-commands "git status && git add ."
```

## Workflow
1. Parse command string
2. Execute in sandboxed environment
3. Stream output in real-time
4. Handle interactive prompts
5. Return exit code and output

## BYOK Keys
Users provide their own API keys - keys never stored on server.

## Terminal Features
- xterm.js compatible
- Interactive command support
- Process control
- Environment variables