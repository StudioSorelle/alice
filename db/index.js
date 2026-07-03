const { createClient } = require('@libsql/client');

let client = null;
if (process.env.TURSO_DATABASE_URL) {
  client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN || ''
  });
}

async function query(sql, args) {
  if (!client) throw new Error('Database not configured — set TURSO_DATABASE_URL');
  return await client.execute({ sql, args: args || [] });
}

module.exports = { query, isConfigured: function() { return !!client; } };
