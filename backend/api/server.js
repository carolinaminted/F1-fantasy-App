const http = require('node:http');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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
  if (request.method === 'GET' && (request.url === '/' || request.url === '/health')) {
    sendJson(response, 200, {
      status: 'ok',
      service: 'lights-out-league-api',
      environment: appEnvironment,
      firebaseProjectId,
    });
    return;
  }

  if (request.method === 'GET' && request.url === '/ready') {
    try {
      const snapshot = await db.collection('app_state').doc('league_config').get();

      if (!snapshot.exists) {
        sendJson(response, 503, {
          status: 'not_ready',
          dependency: 'staging-firestore',
          reason: 'required_document_missing',
        });
        return;
      }

      sendJson(response, 200, {
        status: 'ready',
        dependency: 'staging-firestore',
        environment: appEnvironment,
        firebaseProjectId,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          message: 'Firestore readiness check failed',
          code: error.code || 'unknown',
        }),
      );
      sendJson(response, 503, {
        status: 'not_ready',
        dependency: 'staging-firestore',
        reason: 'dependency_unavailable',
      });
    }
    return;
  }

  sendJson(response, 404, {
    status: 'not_found',
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(
    JSON.stringify({
      message: 'API listening',
      port,
      environment: appEnvironment,
      firebaseProjectId,
    }),
  );
});
