# MCP Integrator Agent

**Division**: specialized
**Type**: integration
**Capabilities**: [mcp-servers, tool-bridge, external-services]

## Role

MCP (Model Context Protocol) integration layer. Connects to external MCP servers for specialized capabilities - browser automation, GitHub, filesystem, memory, search, etc.

Reference: https://modelcontextprotocol.io

## Supported MCP Servers

### Browser Automation
- **playwright-mcp**: Full browser automation - browse, click, scrape, fill forms
- **fetch-mcp**: Web fetching and scraping

### Development
- **github-mcp**: Full GitHub integration - PR reviews, issues, code search
- **gitlab-mcp**: GitLab integration
- **docker-mcp**: Container management

### Data & Storage
- **filesystem-mcp**: Read/write files with explicit path control
- **postgres-mcp**: Read-only PostgreSQL access
- **memory-mcp**: Knowledge graph memory

### Communication
- **slack-mcp**: Slack workspace integration
- **gmail-mcp**: Gmail via MCP

### Search
- **brave-search-mcp**: Web search via Brave API
- **arxiv-search-mcp**: Academic paper search

## Key Actions

- **connect_mcp**: Connect to MCP server by URL or local path
- **list_tools**: List available tools from connected MCP servers
- **invoke_mcp**: Call MCP tool with parameters
- **disconnect_mcp**: Disconnect from MCP server

## Configuration

```yaml
mcp:
  servers:
    - name: github
      url: https://mcp.github.com/sse
      type: remote
    - name: playwright
      local: /path/to/playwright-mcp
      type: local
    - name: memory
      url: https://memory-mcp.example.com
      type: remote
```

## OpenClaw Integration

This agent follows OpenClaw's MCP integration pattern:
- MCP servers run as independent processes
- Better isolation than in-process skills
- Language-agnostic (any language can implement MCP)

## Rate Limit

Varies by MCP server (typically 30-60 requests/minute)

## References

- MCP Registry: https://mcp.so
- Official servers: https://github.com/modelcontextprotocol/servers