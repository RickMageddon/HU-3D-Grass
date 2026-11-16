#!/usr/bin/env node
const net = require('net');

function parseArgs() {
  const args = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v.startsWith('--')) {
      const k = v.slice(2);
      const next = a[i + 1];
      if (!next || next.startsWith('--')) {
        args[k] = true;
      } else {
        args[k] = next;
        i++;
      }
    }
  }
  return args;
}

const argv = parseArgs();
const HOST = argv.host || process.env.SIM_HOST || '127.0.0.1';
const PORT = Number(argv.port || process.env.SIM_PORT || 5000);
const ID = argv.id || process.env.SIM_ID || 'STM01';
const MODE = (argv.mode || process.env.SIM_MODE || 'ramp'); // ramp, sine, random
const INTERVAL = Number(argv.interval || process.env.SIM_INTERVAL || 2000);
const MIN_PF = Number(argv.min || process.env.SIM_MIN || 6.85);
const MAX_PF = Number(argv.max || process.env.SIM_MAX || 8.8);
const COUNT = argv.count ? Number(argv.count) : (process.env.SIM_COUNT ? Number(process.env.SIM_COUNT) : 0);
const RECONNECT = argv.reconnect === 'true' || argv.reconnect === true || process.env.SIM_RECONNECT === 'true' || false;
const RECONNECT_DELAY = Number(argv.reconnectDelay || process.env.SIM_RECONNECT_DELAY || 3000);
const VERBOSE = argv.v || argv.verbose || process.env.SIM_VERBOSE === 'true' || false;

let socket;
let sent = 0;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function makeGenerator(mode, min, max) {
  if (mode === 'random') {
    return () => min + Math.random() * (max - min);
  }
  if (mode === 'sine') {
    let t = 0;
    return () => {
      t += 0.2;
      const mid = (min + max) / 2;
      const amp = (max - min) / 2;
      return clamp(mid + Math.sin(t) * amp, min, max);
    };
  }
  // default: ramp up then down
  let up = true;
  let cur = min;
  const step = Math.max(0.0005, (max - min) / 80);
  return () => {
    if (up) {
      cur += step;
      if (cur >= max) up = false;
    } else {
      cur -= step;
      if (cur <= min) up = true;
    }
    return clamp(cur, min, max);
  };
}

const gen = makeGenerator(MODE, MIN_PF, MAX_PF);

function connectAndStart() {
  if (VERBOSE) console.log(`Attempting connection to ${HOST}:${PORT}`);
  socket = net.createConnection({ host: HOST, port: PORT }, () => {
    if (VERBOSE) console.log('socket connect event');
    console.log(`Connected to ${HOST}:${PORT} — sending measurements as ID=${ID}`);
    const timer = setInterval(() => {
      if (COUNT > 0 && sent >= COUNT) {
        clearInterval(timer);
        socket.end();
        console.log('Done sending');
        process.exit(0);
        return;
      }
      const pf = gen();
      const line = `ID=${ID};C=${pf.toFixed(4)}\n`;
      if (VERBOSE) console.log('sending:', line.trim());
      socket.write(line, 'utf8', (err) => {
        if (err) console.error('Write error:', err.message || err);
      });
      sent++;
      process.stdout.write(`sent #${sent}: ${pf.toFixed(4)} pF\r`);
    }, INTERVAL);
  });

  socket.on('data', (d) => {
    const t = String(d).trim();
    if (t) console.log('\nserver:', t);
  });

  socket.on('end', () => {
    console.log('\nServer ended the connection (end)');
  });

  socket.on('close', (hadError) => {
    console.log(`\nConnection closed${hadError ? ' (had error)' : ''}`);
    if (RECONNECT) {
      console.log(`Reconnecting in ${RECONNECT_DELAY}ms...`);
      setTimeout(() => {
        connectAndStart();
      }, RECONNECT_DELAY);
    } else {
      process.exit(0);
    }
  });

  socket.on('error', (err) => {
    console.error('\nSocket error:', err.message || err);
    // if connection refused and reconnect enabled, try again
    if (RECONNECT) {
      console.log(`Retrying in ${RECONNECT_DELAY}ms...`);
      setTimeout(() => connectAndStart(), RECONNECT_DELAY);
    } else {
      process.exit(1);
    }
  });
}

if (require.main === module) {
  console.log('Simulator options:', { HOST, PORT, ID, MODE, INTERVAL, MIN_PF, MAX_PF, COUNT });
  connectAndStart();
}

module.exports = { connectAndStart };
