# Scaffold - Full App Generation

Generate complete applications from a single prompt using the smol-dev pattern.

## Usage

```
/scaffold "a React TypeScript todo app with drag-drop"
```

## Workflow

1. **Plan** - Analyze requirements, create shared dependencies
2. **Specify** - Generate file paths using function calling
3. **Generate** - Create each file with coherence across dependencies

## Key Patterns

- Markdown is all you need for prompts
- Copy-paste programming: paste API docs/errors into prompt
- Debug by dumping whole codebase with error message
- Shared dependencies ensure cross-file coherence

## Tools Used

- Code executor
- File manager
- Web search (for framework docs)