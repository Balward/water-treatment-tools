#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const services = [
  {
    name: 'frontend',
    color: '\x1b[36m',
    command: process.execPath,
    args: [path.join(rootDir, 'dev-server.js')],
  },
  {
    name: 'api',
    color: '\x1b[32m',
    command: process.execPath,
    args: [path.join(rootDir, 'claude-proxy-server.js')],
  },
];

const reset = '\x1b[0m';
const children = [];

function log(message) {
  process.stdout.write(`${message}\n`);
}

function prefixOutput(service, chunk, writer) {
  const lines = chunk.toString().split(/\r?\n/);
  for (const line of lines) {
    if (!line) {
      continue;
    }
    writer.write(`${service.color}[${service.name}]${reset} ${line}\n`);
  }
}

function shutdown(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    }
    process.exit(exitCode);
  }, 500);
}

for (const service of services) {
  const child = spawn(service.command, service.args, {
    cwd: rootDir,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  children.push(child);

  child.stdout.on('data', (chunk) => {
    prefixOutput(service, chunk, process.stdout);
  });

  child.stderr.on('data', (chunk) => {
    prefixOutput(service, chunk, process.stderr);
  });

  child.on('exit', (code, signal) => {
    if (signal || code) {
      log(`${service.color}[${service.name}]${reset} exited ${signal ? `with signal ${signal}` : `with code ${code}`}`);
      shutdown(code || 1);
    }
  });
}

log('Live Ops dev environment starting...');
log('Frontend: http://localhost:8080/live-operations-dashboard/');
log('TV mode:  http://localhost:8080/live-operations-dashboard/?mode=tv');
log('Press Ctrl+C to stop both servers.');

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
