import React, { useMemo, useState } from 'react';

const toIp = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
const toBin = (n) => [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, '0')).join('.');

function calc(input) {
  const m = input.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if (!m) throw new Error('Enter an IPv4 CIDR such as 10.0.0.0/24');
  const oct = m.slice(1, 5).map(Number);
  const prefix = Number(m[5]);
  if (oct.some((o) => o > 255)) throw new Error('Octets must be 0–255');
  if (prefix > 32) throw new Error('Prefix must be 0–32');
  const ip = ((oct[0] << 24) | (oct[1] << 16) | (oct[2] << 8) | oct[3]) >>> 0;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | ~mask) >>> 0;
  const total = 2 ** (32 - prefix);
  let first;
  let last;
  let hosts;
  if (prefix === 32) {
    first = last = network;
    hosts = 1;
  } else if (prefix === 31) {
    first = network;
    last = broadcast;
    hosts = 2;
  } else {
    first = network + 1;
    last = broadcast - 1;
    hosts = total - 2;
  }
  return {
    'IP address': toIp(ip),
    'Network address': toIp(network),
    'Broadcast address': prefix >= 31 ? 'n/a' : toIp(broadcast),
    'Subnet mask': toIp(mask),
    'Wildcard mask': toIp(~mask >>> 0),
    'First usable host': toIp(first),
    'Last usable host': toIp(last),
    'Usable hosts': hosts.toLocaleString(),
    'Total addresses': total.toLocaleString(),
    'Mask (binary)': toBin(mask),
    'Network (binary)': toBin(network),
  };
}

export function CidrCalculator() {
  const [input, setInput] = useState('10.0.0.0/24');
  const result = useMemo(() => {
    try {
      return { data: calc(input) };
    } catch (e) {
      return { error: e.message };
    }
  }, [input]);

  return (
    <div className="ci-container">
      <h2 className="ci-title">🌐 IP / CIDR Calculator</h2>
      <div className="ci-panel">
        <input className="ci-input ci-wide" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} placeholder="10.0.0.0/24" />
        {result.error && <div className="ci-err ci-gap">⚠ {result.error}</div>}
      </div>
      {result.data && (
        <div className="ci-panel ci-grid">
          {Object.entries(result.data).map(([k, v]) => <div key={k} className="ci-stat"><b>{k}</b><code>{v}</code></div>)}
        </div>
      )}
    </div>
  );
}
