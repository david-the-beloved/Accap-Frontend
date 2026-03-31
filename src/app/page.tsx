import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.kicker}>Accountability Reader</p>
          <h1>Quiet design. Serious reading outcomes.</h1>
          <p className={styles.subtext}>
            Track progress with highlight proof, keep chapter-based notes,
            and stay consistent through shared streak accountability.
          </p>
          <div className={styles.actions}>
            <Link href="/signup" className={styles.primaryAction}>
              Create account
            </Link>
            <Link href="/login" className={styles.secondaryAction}>
              Log in
            </Link>
          </div>
        </div>

        <aside className={styles.infoRail}>
          <div>
            <span>01</span>
            <p>Read with real checkpoints, not manual guess entries.</p>
          </div>
          <div>
            <span>02</span>
            <p>Attach notes to pages and export them anytime.</p>
          </div>
          <div>
            <span>03</span>
            <p>Use the leaderboard to make consistency visible.</p>
          </div>
          <Link href="/leaderboard" className={styles.leaderboardLink}>
            Open leaderboard
          </Link>
        </aside>
      </section>
    </main>
  );
}
