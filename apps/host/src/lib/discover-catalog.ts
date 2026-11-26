import reaBody from '../assets/skills/reverse-engineer-anything.md?raw';

/** A skill the person can add from the Skills screen. Nothing is installed until they press Add, and the copy is saved off. */
export interface DiscoverSkill {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  requires: string;
  source: string;
  body: string;
}

/** An MCP server the person can add from Settings -> Tools. It is saved off; no program starts until they turn it on. */
export interface DiscoverServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  requires: string;
  source: string;
  /** A setup detail shown under the command, for servers that need a folder or a key after they are added. */
  note?: string;
}

/**
 * Curated, deliberately short. These are starting points, not defaults: both screens save every addition disabled, and the
 * existing managers keep the switches. Add entries here when a skill or server has been checked for this app.
 */
export const DISCOVER_SKILLS: DiscoverSkill[] = [
  {
    id: 'rea',
    name: 'REA',
    description: 'Reverse engineer native, managed, Electron/JavaScript, packaged, firmware and browser targets. Uses the REA tool server for evidence and analysis.',
    triggers: ['reverse engineer', 'decompile', 'analyze a binary', 'rea', 'asar', 'apk'],
    requires: 'REA MCP server (rea-agents)',
    source: 'https://github.com/morluto/rea',
    body: reaBody,
  },
];

export const DISCOVER_SERVERS: DiscoverServer[] = [
  {
    id: 'rea',
    name: 'REA',
    description: 'Runs the REA analysis tools for binaries, packages, apps and firmware.',
    command: 'npx',
    args: ['-y', 'rea-agents@6.4.0'],
    requires: 'Node.js (npx)',
    source: 'https://github.com/morluto/rea',
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Keeps a small knowledge graph the assistant can read and update between messages.',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    requires: 'Node.js (npx)',
    source: 'https://github.com/modelcontextprotocol/servers',
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential thinking',
    description: 'Lets the assistant work through a problem in explicit, revisable steps.',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    requires: 'Node.js (npx)',
    source: 'https://github.com/modelcontextprotocol/servers',
  },
  {
    id: 'git',
    name: 'Git',
    description: 'Reads a local Git repository: status, diffs, history and commits.',
    command: 'uvx',
    args: ['mcp-server-git'],
    requires: 'uv (uvx)',
    source: 'https://github.com/modelcontextprotocol/servers',
    note: 'After adding, set --repository to your folder in Edit.',
  },
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'Fetches a web page and turns it into Markdown for the assistant.',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    requires: 'uv (uvx)',
    source: 'https://github.com/modelcontextprotocol/servers',
  },
  {
    id: 'time',
    name: 'Time',
    description: 'Converts times between time zones and answers what time it is.',
    command: 'uvx',
    args: ['mcp-server-time'],
    requires: 'uv (uvx)',
    source: 'https://github.com/modelcontextprotocol/servers',
  },
];
