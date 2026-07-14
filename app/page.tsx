import { Pool } from 'pg';

// Initialize the database connection pool directly on the server
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function Home() {
  let dbTime = "Connecting directly to database...";

  try {
    // Talk to the Docker container directly without an internal HTTP fetch
    const result = await pool.query('SELECT NOW()');
    dbTime = result.rows[0].now.toString();
  } catch (err: any) {
    dbTime = `Database Error: ${err.message}`;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-6">
      <div className="max-w-xl w-full bg-slate-800 rounded-xl p-8 shadow-2xl border border-slate-700 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          CourseDekho Live Server
        </h1>
        <p className="text-slate-400 text-sm font-mono mb-6">Next.js + Docker PostgreSQL</p>
        
        <div className="bg-slate-950 rounded-lg p-4 text-left font-mono border border-slate-800">
          <div className="flex items-center space-x-2 text-emerald-400 mb-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-sm font-bold">System Status: Connected</span>
          </div>
          <p className="text-xs text-slate-400 mt-3">DATABASE CONTAINER TIME:</p>
          <p className="text-sm text-yellow-400 font-bold mt-1 break-all">{dbTime}</p>
        </div>
      </div>
    </main>
  );
}