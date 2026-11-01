import test from 'node:test';
import assert from 'node:assert/strict';

test('Cliente API distingue una conexión fallida de una contraseña incorrecta sin reenviar el login', async () => {
  const originalStorage = globalThis.localStorage;
  const originalFetch = globalThis.fetch;
  globalThis.localStorage = { getItem: () => '' };
  try {
    const { api } = await import('../../../client/src/services/api.js');
    let attempts = 0;
    globalThis.fetch = async (url, options) => {
      attempts++;
      assert.equal(url, '/api/auth/login');
      assert.equal(options.body, '{"username":"admin","password":"incorrecta"}');
      throw new TypeError('Failed to fetch');
    };
    const options = { method: 'POST', body: '{"username":"admin","password":"incorrecta"}' };
    await assert.rejects(api('/auth/login', options), error => error.code === 'NETWORK_ERROR' && /servidor de asistencia/.test(error.message));
    assert.equal(attempts, 1);
    globalThis.fetch = async () => new Response('{"message":"Usuario o clave incorrectos"}', { status: 401, headers: { 'Content-Type': 'application/json' } });
    await assert.rejects(api('/auth/login', options), error => error.status === 401 && error.message === 'Usuario o clave incorrectos');
    globalThis.fetch = async () => new Response('<html>Sin API</html>', { headers: { 'Content-Type': 'text/html' } });
    await assert.rejects(api('/health'), /no devolvió una respuesta/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
