# validation-api-service

Accepts mobilityDCAT-AP validation requests and creates jobs in the triplestore.
Guards against abuse (SSRF, rate limits) so that `POST /validation-jobs`
cannot go directly through mu-cl-resources.

Companion worker: `catalog-harvester-service` (and a future
`dcat-validator-service`) pick up `task:Task` records with
`task:operation ext:MobilityDcatValidationTask` via the delta channel.

## Endpoints

### `POST /validation-jobs`

JSON:API request body:

```json
{
  "data": {
    "type": "validation-jobs",
    "attributes": {
      "endpoint-url": "https://example.org/catalog.ttl"
    }
  }
}
```

**201** — new job created, worker will pick it up:

```json
{
  "data": {
    "type": "validation-jobs",
    "id": "<uuid>",
    "attributes": {
      "endpoint-url": "…",
      "status": "scheduled",
      "created-at": "2026-04-23T14:00:00Z"
    }
  }
}
```

**201** — cache hit, a completed job pointing at the recent report:

```json
{
  "data": {
    "type": "validation-jobs",
    "id": "<uuid>",
    "attributes": {
      "endpoint-url": "…",
      "status": "completed",
      "created-at": "…",
      "cached": true,
      "cached-from-age-hours": 2.3
    },
    "relationships": {
      "report": { "data": { "type": "validation-reports", "id": "<report-uuid>" } }
    }
  }
}
```

**Errors** (JSON:API `errors` array):

| Status | Code                  | When                                                        |
|-------:|-----------------------|-------------------------------------------------------------|
| 400    | `invalid_url`         | URL unparseable                                             |
| 400    | `invalid_protocol`    | Not http/https                                              |
| 400    | `missing_endpoint_url`| Attribute missing                                           |
| 400    | `blocked_host`        | Hostname resolves to private/loopback/metadata IP (SSRF)    |
| 400    | `unresolvable_host`   | DNS lookup returned no records                              |
| 429    | `rate_limited`        | Per-IP or global hourly limit reached; `meta.retry_after_seconds` |
| 500    | `internal_error`      | SPARQL update failed                                        |

## Guards

- **SSRF** — `lib/ssrf.js`. `dns.lookup` + `ipaddr.js`; only globally-routable
  unicast addresses are accepted. Everything else (RFC1918, loopback,
  link-local, unique-local, multicast, reserved, metadata IPs) is rejected.
- **Rate limiting** — `lib/rate-limiter.js`. In-memory sliding window, per-IP
  and global. Single-replica service; counters reset on restart. Switch to
  Redis if we ever scale horizontally.

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `MU_APPLICATION_GRAPH` | `http://mu.semte.ch/graphs/public` | Graph for job/task triples |
| `RATE_LIMIT_PER_IP` | `5` | Validations per IP per window |
| `RATE_LIMIT_GLOBAL` | `20` | Validations globally per window |
| `RATE_LIMIT_WINDOW_MS` | `3600000` | Window length in ms (1h) |
| `CACHE_TTL_HOURS` | `6` | Consider a matching report a cache hit if within this window |

## Vocabulary

Matches `catalog-harvester-service`:

- `cogs:Job` — top-level job (`task:operation` → `…/JobOperation/mobility-dcat-validation-job`)
- `task:Task` — sub-task (`task:operation` → `ext:MobilityDcatValidationTask`),
  `dct:isPartOf` the job, `task:inputContainer` holds the endpoint URL
- `nfo:DataContainer` with `ext:content "<endpoint-url>"`
- `adms:status` one of `…/JobStatus/{scheduled,busy,success,failed}`
- `ext:endpointUrl` (additional) — the raw endpoint URL on the job, for cache lookup
- `ext:report` (additional) — relationship from a completed job to its `ext:ValidationReport`
