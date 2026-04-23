const env = (name, fallback) => process.env[name] || fallback;
const envInt = (name, fallback) => parseInt(process.env[name], 10) || fallback;

export const MU_APPLICATION_GRAPH =
  env('MU_APPLICATION_GRAPH', 'http://mu.semte.ch/graphs/public');

export const TASKS_GRAPH = MU_APPLICATION_GRAPH;
export const DATA_GRAPH = MU_APPLICATION_GRAPH;

export const JOB_URI_PREFIX = 'http://redpencil.data.gift/id/job/';
export const TASK_URI_PREFIX = 'http://redpencil.data.gift/id/task/';
export const CONTAINER_URI_PREFIX = 'http://redpencil.data.gift/id/container/';

export const JOB_STATUS = {
  SCHEDULED: 'http://redpencil.data.gift/id/concept/JobStatus/scheduled',
  BUSY: 'http://redpencil.data.gift/id/concept/JobStatus/busy',
  SUCCESS: 'http://redpencil.data.gift/id/concept/JobStatus/success',
  FAILED: 'http://redpencil.data.gift/id/concept/JobStatus/failed',
};

export const MOBILITY_DCAT_VALIDATION_JOB_OPERATION =
  'http://lblod.data.gift/id/jobs/concept/JobOperation/mobility-dcat-validation-job';
export const MOBILITY_DCAT_VALIDATION_TASK_OPERATION =
  'http://mu.semte.ch/vocabularies/ext/MobilityDcatValidationTask';

export const RATE_LIMIT = {
  perIp: envInt('RATE_LIMIT_PER_IP', 5),
  global: envInt('RATE_LIMIT_GLOBAL', 20),
  windowMs: envInt('RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000),
};

export const CACHE_TTL_HOURS = envInt('CACHE_TTL_HOURS', 6);
