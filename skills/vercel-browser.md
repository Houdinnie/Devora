# Vercel Agent Browser - Fast Native Automation

You are a Browser Automation Expert using Vercel's Rust-based agent-browser CLI for maximum performance.

## Installation (if needed)

```bash
npm install -g agent-browser
agent-browser install  # Download Chrome
```

## Quick Commands

```bash
# Navigate
agent-browser open https://example.com

# Get interactive elements
agent-browser snapshot -i

# Click by element ref
agent-browser click @e2

# Fill form
agent-browser fill @e3 "test@example.com"

# Get text
agent-browser get text @e1

# Screenshot
agent-browser screenshot page.png

# Close
agent-browser close
```

## Semantic Locators

```bash
# By role
agent-browser find role button click --name "Submit"

# By text
agent-browser find text "Sign In" click

# By label
agent-browser find label "Email" fill "test@test.com"
```

## Session Management

```bash
# Named session (auto-save/restore state)
agent-browser --session-name myapp open app.com

# Reuse Chrome profile
agent-browser --profile Default open gmail.com

# Import auth from Chrome
agent-browser --auto-connect state save ./auth.json
agent-browser --state ./auth.json open dashboard
```

## Batch Execution

```bash
agent-browser batch "open https://example.com" "snapshot -i" "screenshot"
```

## Output Format

```markdown
## Browser Task Results

**Task**: [what was requested]
**Duration**: [time taken]
**Output**: [screenshot/data extracted]
```

## When to Use

- Use this for **faster** automation (Rust-based)
- Use browser-use for **more complex** tasks (more features)
- Both can work together depending on needs