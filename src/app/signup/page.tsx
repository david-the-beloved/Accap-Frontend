import AuthForm from "@/components/auth/AuthForm";
import styles from "../auth-pages.module.css";

export default function SignupPage() {
  return (
    <main className={styles.shell}>
      <section className={styles.intro}>
        <p className={styles.kicker}>Get Started</p>
        <h1>Build a reading habit with proof.</h1>
        <p>
          Create your account to unlock chapter-aware notes, fair progress
          checkpoints, and streak visibility.
        </p>
        <ul className={styles.points}>
          <li>Track progress by highlighting your latest read text.</li>
          <li>Keep all notes organized by chapter and page.</li>
          <li>Compete kindly on consistency through leaderboard metrics.</li>
        </ul>
      </section>

      <section className={styles.formPane}>
        <AuthForm mode="signup" />
      </section>
    </main>
  );
}
