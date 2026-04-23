import {
  updateSudo as update,
  querySudo as query,
} from '@lblod/mu-auth-sudo';
import {
  sparqlEscapeUri,
  sparqlEscapeString,
  sparqlEscapeDateTime,
  uuid as generateUuid,
} from 'mu';

import {
  TASKS_GRAPH,
  JOB_URI_PREFIX,
  TASK_URI_PREFIX,
  CONTAINER_URI_PREFIX,
  JOB_STATUS,
  MOBILITY_DCAT_VALIDATION_JOB_OPERATION,
  MOBILITY_DCAT_VALIDATION_TASK_OPERATION,
  CACHE_TTL_HOURS,
} from '../constants.js';

export async function insertValidationJob(endpointUrl) {
  const jobId = generateUuid();
  const taskId = generateUuid();
  const containerId = generateUuid();
  const now = new Date();

  const jobUri = JOB_URI_PREFIX + jobId;
  const taskUri = TASK_URI_PREFIX + taskId;
  const containerUri = CONTAINER_URI_PREFIX + containerId;

  const sparql = `
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX cogs: <http://vocab.deri.ie/cogs#>
PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
PREFIX adms: <http://www.w3.org/ns/adms#>
PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>

INSERT DATA {
  GRAPH ${sparqlEscapeUri(TASKS_GRAPH)} {
    ${sparqlEscapeUri(containerUri)} a nfo:DataContainer ;
      mu:uuid ${sparqlEscapeString(containerId)} ;
      ext:content ${sparqlEscapeString(endpointUrl)} .

    ${sparqlEscapeUri(jobUri)} a cogs:Job ;
      mu:uuid ${sparqlEscapeString(jobId)} ;
      dct:created ${sparqlEscapeDateTime(now)} ;
      dct:modified ${sparqlEscapeDateTime(now)} ;
      dct:creator "validation-api" ;
      task:operation ${sparqlEscapeUri(MOBILITY_DCAT_VALIDATION_JOB_OPERATION)} ;
      ext:endpointUrl ${sparqlEscapeString(endpointUrl)} ;
      adms:status ${sparqlEscapeUri(JOB_STATUS.SCHEDULED)} .

    ${sparqlEscapeUri(taskUri)} a task:Task ;
      mu:uuid ${sparqlEscapeString(taskId)} ;
      dct:created ${sparqlEscapeDateTime(now)} ;
      dct:modified ${sparqlEscapeDateTime(now)} ;
      task:index "0" ;
      dct:isPartOf ${sparqlEscapeUri(jobUri)} ;
      task:inputContainer ${sparqlEscapeUri(containerUri)} ;
      task:operation ${sparqlEscapeUri(MOBILITY_DCAT_VALIDATION_TASK_OPERATION)} ;
      adms:status ${sparqlEscapeUri(JOB_STATUS.SCHEDULED)} .
  }
}`;

  await update(sparql);

  return {
    id: jobId,
    uri: jobUri,
    endpointUrl,
    status: 'scheduled',
    createdAt: now.toISOString(),
  };
}

export async function findRecentReportForEndpoint(endpointUrl) {
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000);
  const sparql = `
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

SELECT ?reportId ?created WHERE {
  GRAPH ${sparqlEscapeUri(TASKS_GRAPH)} {
    ?report a ext:ValidationReport ;
            mu:uuid ?reportId ;
            dct:created ?created ;
            ext:endpointUrl ${sparqlEscapeString(endpointUrl)} .
    FILTER (?created >= ${sparqlEscapeDateTime(cutoff)})
  }
} ORDER BY DESC(?created) LIMIT 1`;

  const result = await query(sparql);
  const binding = result?.results?.bindings?.[0];
  if (!binding) return null;

  const created = new Date(binding.created.value);
  const ageHours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  return {
    reportId: binding.reportId.value,
    createdAt: created.toISOString(),
    ageHours: Math.round(ageHours * 10) / 10,
  };
}

export async function insertCompletedJobForCachedReport(endpointUrl, cachedReport) {
  const jobId = generateUuid();
  const now = new Date();
  const jobUri = JOB_URI_PREFIX + jobId;
  const reportUri = `http://redpencil.data.gift/id/validation-report/${cachedReport.reportId}`;

  const sparql = `
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX cogs: <http://vocab.deri.ie/cogs#>
PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
PREFIX adms: <http://www.w3.org/ns/adms#>
PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

INSERT DATA {
  GRAPH ${sparqlEscapeUri(TASKS_GRAPH)} {
    ${sparqlEscapeUri(jobUri)} a cogs:Job ;
      mu:uuid ${sparqlEscapeString(jobId)} ;
      dct:created ${sparqlEscapeDateTime(now)} ;
      dct:modified ${sparqlEscapeDateTime(now)} ;
      dct:creator "validation-api" ;
      task:operation ${sparqlEscapeUri(MOBILITY_DCAT_VALIDATION_JOB_OPERATION)} ;
      ext:endpointUrl ${sparqlEscapeString(endpointUrl)} ;
      ext:report ${sparqlEscapeUri(reportUri)} ;
      ext:cacheHit "true"^^<http://www.w3.org/2001/XMLSchema#boolean> ;
      adms:status ${sparqlEscapeUri(JOB_STATUS.SUCCESS)} .
  }
}`;

  await update(sparql);

  return {
    id: jobId,
    uri: jobUri,
    endpointUrl,
    status: 'completed',
    createdAt: now.toISOString(),
    reportId: cachedReport.reportId,
    cached: true,
    cachedFromAgeHours: cachedReport.ageHours,
  };
}
