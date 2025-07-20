const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'calendar.db');

let dbInstance = null;

/**
 * Get a database connection instance
 * @returns {Promise<sqlite3.Database>}
 */
function getDb() {
  return new Promise((resolve, reject) => {
    if (!dbInstance) {
      dbInstance = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
          console.error('Error opening database', err);
          reject(err);
          return;
        }
        
        // Enable foreign key constraints
        dbInstance.serialize(() => {
          dbInstance.run('PRAGMA foreign_keys = ON');
          // Enable WAL mode for better concurrency
          dbInstance.run('PRAGMA journal_mode = WAL');
          resolve(dbInstance);
        });
      });
    } else {
      resolve(dbInstance);
    }
  });
}

/**
 * Close the database connection
 * @returns {Promise<void>}
 */
function closeDb() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      dbInstance.close((err) => {
        if (err) {
          console.error('Error closing database', err);
          reject(err);
          return;
        }
        dbInstance = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Run a query with parameters
 * @param {string} sql
 * @param {any[]} params
 * @returns {Promise<{lastID: number, changes: number}>}
 */
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().then(db => {
      db.run(sql, params, function(err) {
        if (err) {
          console.error('Error running query', err);
          reject(err);
          return;
        }
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    }).catch(reject);
  });
}

/**
 * Get a single row
 * @param {string} sql
 * @param {any[]} params
 * @returns {Promise<any>}
 */
function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().then(db => {
      db.get(sql, params, (err, row) => {
        if (err) {
          console.error('Error getting row', err);
          reject(err);
          return;
        }
        resolve(row);
      });
    }).catch(reject);
  });
}

/**
 * Get multiple rows
 * @param {string} sql
 * @param {any[]} params
 * @returns {Promise<any[]>}
 */
function getRows(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().then(db => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Error getting rows', err);
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    }).catch(reject);
  });
}

module.exports = {
  getDb,
  closeDb,
  runQuery,
  getRow,
  getRows
};
