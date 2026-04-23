import dns from 'dns/promises';
import ipaddr from 'ipaddr.js';

class UrlValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export async function validateEndpointUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new UrlValidationError('invalid_url', 'Could not parse the URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new UrlValidationError(
      'invalid_protocol',
      'Only http and https URLs are supported.',
    );
  }

  if (!url.hostname) {
    throw new UrlValidationError('invalid_url', 'URL is missing a hostname.');
  }

  const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length) {
    throw new UrlValidationError('unresolvable_host', 'Hostname did not resolve.');
  }

  for (const { address } of records) {
    let addr;
    try {
      addr = ipaddr.parse(address);
    } catch {
      throw new UrlValidationError(
        'blocked_host',
        `Hostname resolved to an unparseable address: ${address}.`,
      );
    }
    const range = addr.range();
    // Accept only globally-routable unicast addresses. Everything else —
    // private, loopback, link-local, multicast, unique-local, metadata IPs,
    // reserved ranges — is rejected to prevent SSRF.
    if (range !== 'unicast') {
      throw new UrlValidationError(
        'blocked_host',
        `Hostname ${url.hostname} resolves to a ${range} address (${address}); only public addresses are allowed.`,
      );
    }
  }
}
