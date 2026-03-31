import AuthForm from "@/components/auth/AuthForm";
import styles from "../auth-pages.module.css";

export default function LoginPage() {
  return (
    <main className={styles.shell}>
      <section className={styles.intro}>
        <p className={styles.kicker}>Welcome Back</p>
        <h1>Continue where you paused.</h1>
        <p>
          Your streak, notes, and checkpoints are ready. Sign in to return to
          your exact reading context.
        </p>
        <ul className={styles.points}>
          <li>Resume from your latest chapter checkpoint.</li>
          <li>See your saved notes per page instantly.</li>
          <li>Stay consistent with accountability tracking.</li>
        </ul>
      </section>

      <section className={styles.formPane}>
        <AuthForm mode="login" />
      </section>
    </main>
  );
}
