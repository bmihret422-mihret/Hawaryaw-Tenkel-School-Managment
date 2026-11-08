const oracledb = require('oracledb');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Ensure output is returned as JavaScript objects with column name keys
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false;

// Initialize Oracle Thick client if directory is provided or auto-detected
let clientInitialized = false;

function initClient() {
  if (clientInitialized) return;

  const candidatePaths = [
    process.env.ORACLE_CLIENT_DIR,
    'C:\\Users\\hp\\Downloads\\instantclient-basic-windows.x64-19.32.0.0.0dbru\\instantclient_19_32',
    path.join(__dirname, '..', 'instantclient'),
    'C:\\oracle\\instantclient_19_32',
    'C:\\oracle\\instantclient_21_3'
  ].filter(Boolean);

  for (const clientPath of candidatePaths) {
    if (fs.existsSync(clientPath)) {
      try {
        oracledb.initOracleClient({ libDir: clientPath });
        console.log(`[OracleDB] Initialized Oracle Instant Client from: ${clientPath}`);
        clientInitialized = true;
        return;
      } catch (err) {
        if (err.message.includes('NJS-077') || err.message.includes('already been called')) {
          clientInitialized = true;
          return;
        }
        console.warn(`[OracleDB] Could not initialize from ${clientPath}:`, err.message);
      }
    }
  }

  // Fallback: try default init (e.g. if oci.dll is in system PATH)
  try {
    oracledb.initOracleClient();
    clientInitialized = true;
    console.log('[OracleDB] Initialized Oracle client using system PATH.');
  } catch (err) {
    if (err.message.includes('NJS-077') || err.message.includes('already been called')) {
      clientInitialized = true;
    } else {
      console.warn('[OracleDB] Warning: Oracle client initialization note:', err.message);
    }
  }
}

initClient();

const dbConfig = {
  user: process.env.DB_USER || 'SCHOOL_DB',
  password: process.env.DB_PASSWORD || 'School123',
  connectString: process.env.DB_CONNECT_STRING || 'localhost:1521/XE',
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 2,
  poolTimeout: 60
};

let pool = null;

async function initializePool() {
  if (pool) return pool;
  try {
    pool = await oracledb.createPool(dbConfig);
    console.log(`[OracleDB] Connection pool created successfully for user: ${dbConfig.user}`);
    return pool;
  } catch (err) {
    console.error('[OracleDB] Error creating connection pool:', err.message);
    throw err;
  }
}

async function closePool() {
  if (pool) {
    try {
      await pool.close(10);
      console.log('[OracleDB] Connection pool closed.');
      pool = null;
    } catch (err) {
      console.error('[OracleDB] Error closing pool:', err.message);
    }
  }
}

/**
 * Executes a query with a borrowed connection from the pool and releases it.
 * @param {string} sql
 * @param {object|array} [binds]
 * @param {object} [options]
 */
async function execute(sql, binds = {}, options = {}) {
  let conn;
  try {
    if (!pool) {
      await initializePool();
    }
    conn = await pool.getConnection();
    const result = await conn.execute(sql, binds, {
      autoCommit: options.autoCommit !== undefined ? options.autoCommit : true,
      ...options
    });
    return result;
  } catch (err) {
    console.error('[OracleDB Query Error]:', err.message, '\nQuery:', sql);
    throw err;
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (closeErr) {
        console.error('[OracleDB] Error releasing connection:', closeErr.message);
      }
    }
  }
}

/**
 * Executes multiple operations within a single database transaction.
 * @param {Function} callback - async function(conn)
 */
async function withTransaction(callback) {
  let conn;
  try {
    if (!pool) {
      await initializePool();
    }
    conn = await pool.getConnection();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rbErr) {
        console.error('[OracleDB] Rollback failed:', rbErr.message);
      }
    }
    throw err;
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (closeErr) {
        console.error('[OracleDB] Error releasing connection:', closeErr.message);
      }
    }
  }
}

/**
 * Health check & diagnostic info
 */
async function checkHealth() {
  try {
    const res = await execute("SELECT SYSDATE AS current_time, USER AS current_user, BANNER FROM v$version WHERE ROWNUM = 1");
    return {
      status: 'UP',
      database: 'Oracle Database XE',
      currentTime: res.rows[0]?.CURRENT_TIME,
      user: res.rows[0]?.CURRENT_USER,
      version: res.rows[0]?.BANNER,
      pool: {
        connectionsInUse: pool ? pool.connectionsInUse : 0,
        connectionsOpen: pool ? pool.connectionsOpen : 0
      }
    };
  } catch (err) {
    return {
      status: 'DOWN',
      error: err.message
    };
  }
}

module.exports = {
  oracledb,
  initializePool,
  closePool,
  execute,
  withTransaction,
  checkHealth
};
