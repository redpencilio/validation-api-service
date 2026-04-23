// see https://github.com/mu-semtech/mu-javascript-template for more info

import { app, errorHandler } from 'mu';
import bodyParser from 'body-parser';

import { validateEndpointUrl } from './lib/ssrf.js';
import { checkRateLimit, getClientIp } from './lib/rate-limiter.js';
import { sendError, sendResource } from './lib/json-api.js';
import {
  insertValidationJob,
  findRecentReportForEndpoint,
  insertCompletedJobForCachedReport,
} from './lib/validation-job.js';

app.use(
  bodyParser.json({ type: ['application/json', 'application/vnd.api+json'] }),
);

app.post('/validation-jobs', async (req, res) => {
  const body = req.body || {};
  if (body?.data?.type !== 'validation-jobs') {
    return sendError(
      res,
      400,
      'invalid_type',
      "Request 'data.type' must be 'validation-jobs'.",
    );
  }
  const attrs = body.data.attributes || {};
  const endpointUrl = attrs['endpoint-url'];
  if (!endpointUrl || typeof endpointUrl !== 'string') {
    return sendError(
      res,
      400,
      'missing_endpoint_url',
      "Attribute 'endpoint-url' is required.",
    );
  }

  try {
    await validateEndpointUrl(endpointUrl);
  } catch (err) {
    return sendError(res, 400, err.code || 'invalid_url', err.message);
  }

  const rl = checkRateLimit(getClientIp(req));
  if (!rl.allowed) {
    return sendError(
      res,
      429,
      'rate_limited',
      rl.scope === 'global'
        ? 'The service is busy right now. Please try again later.'
        : 'You have reached the hourly limit for this IP. Please try again later.',
      {
        headers: { 'Retry-After': rl.retryAfterSeconds },
        meta: { retry_after_seconds: rl.retryAfterSeconds },
      },
    );
  }

  try {
    const cached = await findRecentReportForEndpoint(endpointUrl);
    if (cached) {
      const job = await insertCompletedJobForCachedReport(endpointUrl, cached);
      return sendResource(res, 201, {
        type: 'validation-jobs',
        id: job.id,
        attributes: {
          'endpoint-url': job.endpointUrl,
          status: job.status,
          'created-at': job.createdAt,
          cached: true,
          'cached-from-age-hours': job.cachedFromAgeHours,
        },
        relationships: {
          report: {
            data: { type: 'validation-reports', id: cached.reportId },
          },
        },
      });
    }

    const job = await insertValidationJob(endpointUrl);
    return sendResource(res, 201, {
      type: 'validation-jobs',
      id: job.id,
      attributes: {
        'endpoint-url': job.endpointUrl,
        status: job.status,
        'created-at': job.createdAt,
      },
    });
  } catch (err) {
    console.error('Failed to create validation job', err);
    return sendError(
      res,
      500,
      'internal_error',
      'Could not create the validation job.',
    );
  }
});

app.use(errorHandler);
