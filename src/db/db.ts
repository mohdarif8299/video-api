import sqlite3 from "sqlite3";

class Database {
    [x: string]: any;
    private db: sqlite3.Database;

    constructor() {
        this.db = new sqlite3.Database("./video-api.db", (err) => {
            if (err) {
                console.error("Error opening database:", err);
            } else {
                console.log("Connected to SQLite database.");
            }
        });

        this.initializeTables();
    }

    private initializeTables() {
        this.db.serialize(() => {
            this.db.run(`
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

            this.db.run(`
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

            console.log("Database tables are set up.");
        });
    }

    run(query: string, params: any[]): Promise<{ lastID: number, changes: number }> {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(query: string, params: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    close() {
        this.db.close();
    }
}

export default new Database();