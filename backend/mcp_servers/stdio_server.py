#!/usr/bin/env python3
"""
Stdio MCP server entry point for Claude Code integration.
Run via: /path/to/venv/python -m mcp_servers.stdio_server
Exposes all 6 AI Company crews as MCP tools (no WebSocket broadcasting).
"""
import sys
import os

# Add backend dir to path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp_servers.crew_server import get_server

if __name__ == "__main__":
    server = get_server()
    server.run(transport="stdio")
