"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LeaderboardEntry, getLeaderboard } from "@/lib/api";
import styles from "./page.module.css";

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLeaderboard() {
    setLoading(true);
    setError(null);
    try {
      const data = await getLeaderboard();
      setRows(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeaderboard();
  }, []);

  return (
    <main className={styles.page}>
      <header className="top-nav">
        <div className="links">
          <Link href="/">Home</Link>
          <Link href="/reader">Reader</Link>
          <Link href="/login">Log in</Link>
        </div>
        <button onClick={loadLeaderboard}>Refresh</button>
      </header>

      <section className={styles.card}>
        <h1>Streak leaderboard</h1>
        <p>Public accountability ranking sorted by current streak.</p>

        {loading ? <p>Loading...</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        {!loading && !error ? (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Email</th>
                <th>Current streak</th>
                <th>Best streak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.email}>
                  <td>{index + 1}</td>
                  <td>{row.email}</td>
                  <td>{row.current_streak}</td>
                  <td>{row.highest_streak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
