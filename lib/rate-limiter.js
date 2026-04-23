import { RATE_LIMIT } from '../constants.js';

const perIp = new Map();
let globalHits = [];

function prune(arr, cutoff) {
  let i = 0;
  while (i < arr.length && arr[i] < cutoff) i++;
  if (i > 0) arr.splice(0, i);
}

export function checkRateLimit(ip) {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT.windowMs;

  prune(globalHits, cutoff);
  if (globalHits.length >= RATE_LIMIT.global) {
    const retryAfterSeconds = Math.ceil(
      (RATE_LIMIT.windowMs - (now - globalHits[0])) / 1000,
    );
    return {
      allowed: false,
      scope: 'global',
      retryAfterSeconds,
    };
  }

  let hits = perIp.get(ip);
  if (!hits) {
    hits = [];
    perIp.set(ip, hits);
  }
  prune(hits, cutoff);
  if (hits.length >= RATE_LIMIT.perIp) {
    const retryAfterSeconds = Math.ceil(
      (RATE_LIMIT.windowMs - (now - hits[0])) / 1000,
    );
    return {
      allowed: false,
      scope: 'ip',
      retryAfterSeconds,
    };
  }

  hits.push(now);
  globalHits.push(now);
  return { allowed: true };
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
}
