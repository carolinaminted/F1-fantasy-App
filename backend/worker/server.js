const http = require('node:http');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { recalculateEntireLeague } = require('./scoring');

const port = Number.parseInt(process.env.PORT || '8080', 10);
const appEnvironment = process.env.APP_ENV;
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;

const allowedTargets = {
  staging: 'formula-fantasy-staging',
  production: 'formula-fantasy-1',
};

if (!Object.hasOwn(allowedTargets, appEnvironment)) {
  throw new Error('APP_ENV must be explicitly set to staging or production.');
}

if (allowedTargets[appEnvironment] !== firebaseProjectId) {
  throw new Error(
    `Firebase target mismatch: ${appEnvironment} must use ${allowedTargets[appEnvironment]}.`,
  );
}

initializeApp({ projectId: firebaseProjectId });
const db = getFirestore();

const sendJson = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(body));
};

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;

  if (request.method === 'GET' && pathname === '/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'lights-out-league-worker',
      environment: appEnvironment,
      firebaseProjectId,
    });
    return;
  }

  if (request.method === 'POST' && pathname === '/tasks/reconcile') {
    const startedAt = Date.now();
    try {
      const usersProcessed = await recalculateEntireLeague(db);
      console.info(
        JSON.stringify({
          message: 'Worker league reconciliation succeeded',
          usersProcessed,
          durationMs: Date.now() - startedAt,
        }),
      );
      sendJson(response, 200, { success: true, usersProcessed });
    } catch (error) {
      console.error(
        JSON.stringify({
          message: 'Worker league reconciliation failed',
          code: error.code || 'internal',
          durationMs: Date.now() - startedAt,
        }),
      );
      sendJson(response, 500, {
        success: false,
        error: {
          code: 'internal',
          message: 'Reconciliation failed on the server.',
        },
      });
    }
    return;
  }

  sendJson(response, 404, { status: 'not_found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(
    JSON.stringify({
      message: 'Worker listening',
      port,
      environment: appEnvironment,
      firebaseProjectId,
    }),
  );
});
