const JSON_API_CONTENT_TYPE = 'application/vnd.api+json';

export function sendError(res, status, code, detail, { headers = {}, meta } = {}) {
  Object.entries(headers).forEach(([k, v]) => res.set(k, String(v)));
  res.status(status).type(JSON_API_CONTENT_TYPE).json({
    errors: [
      {
        status: String(status),
        code,
        title: defaultTitle(code),
        detail,
        ...(meta ? { meta } : {}),
      },
    ],
  });
}

export function sendResource(res, status, { type, id, attributes, relationships }, included) {
  const body = {
    data: {
      type,
      id,
      attributes,
      ...(relationships ? { relationships } : {}),
    },
    ...(included?.length ? { included } : {}),
  };
  res.status(status).type(JSON_API_CONTENT_TYPE).json(body);
}

function defaultTitle(code) {
  switch (code) {
    case 'invalid_url':
    case 'invalid_protocol':
    case 'missing_endpoint_url':
      return 'Invalid request';
    case 'blocked_host':
    case 'unresolvable_host':
      return 'Endpoint not accepted';
    case 'rate_limited':
      return 'Rate limit exceeded';
    default:
      return 'Request rejected';
  }
}
