import sqlite3 from "sqlite3";

let dbInstance: ReturnType<typeof createDatabase> | null = null;

const createDatabase = (): { run: (query: string, params: any[]) => Promise<{ lastID: number; changes: number }>; get: (query: string, params: any[]) => Promise<any>; close: () => Promise<void> } => {
    if (dbInstance) {
        return dbInstance;
    }
    const db = new sqlite3.Database("./video-api.db", (err) => {
        if (err) {
            console.error("Error opening database:", err);
        } else {
            console.log("Connected to SQLite database.");
        }
    });

    const initializeTables = () => {
        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS videos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT NOT NULL,
                    filepath TEXT NOT NULL,
                    original_filepath TEXT,
                    size INTEGER NOT NULL,
                    duration REAL NOT NULL,
                    merged_from TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS shareable_links (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    video_id INTEGER NOT NULL,
                    token TEXT NOT NULL UNIQUE,
                    expiry TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(video_id) REFERENCES videos(id)
                )
            `);
        });
    };

    // Initialize tables only once
    initializeTables();

    const run = (query: string, params: any[]): Promise<{ lastID: number; changes: number }> => {
        return new Promise((resolve, reject) => {
            db.run(query, params, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    };

    const get = (query: string, params: any[]): Promise<any> => {
        return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    };

    const close = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    // Reset the instance when closed
                    dbInstance = null;
                    resolve();
                }
            });
        });
    };

    // Store and return the singleton instance
    dbInstance = {
        run,
        get,
        close,
    };

    return dbInstance;
};

export default createDatabase;