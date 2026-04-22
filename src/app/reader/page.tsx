"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import ReadingGoalForm from "@/components/goals/ReadingGoalForm";
import NotesPanel from "@/components/notes/NotesPanel";
import {
  ApiError,
  clearToken,
  getLatestReadingProgress,
  getMe,
  getMyReadingPlan,
  getToken,
  updateReadingProgress,
} from "@/lib/api";
import styles from "./page.module.css";

const PdfReader = dynamic(() => import("@/components/pdf/PdfReader"), {
  ssr: false,
});

const bookUrl = process.env.NEXT_PUBLIC_BOOK_URL || "/book.pdf";
const configuredBookVersion = process.env.NEXT_PUBLIC_BOOK_VERSION;

function normalizeVersion(value: string): string {
  return value.replaceAll('"', "").trim();
}

function versionFromUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl, window.location.origin);
    const explicit = url.searchParams.get("v") || url.searchParams.get("version");
    return explicit ? normalizeVersion(explicit) : null;
  } catch {
    return null;
  }
}

async function detectBookVersion(fileUrl: string): Promise<string> {
  if (configuredBookVersion?.trim()) {
    return normalizeVersion(configuredBookVersion);
  }

  const queryVersion = versionFromUrl(fileUrl);
  if (queryVersion) {
    return queryVersion;
  }

  try {
    const response = await fetch(fileUrl, {
      method: "HEAD",
      cache: "no-store",
    });

    if (response.ok) {
      const etag = response.headers.get("etag");
      if (etag) {
        return normalizeVersion(etag);
      }

      const lastModified = response.headers.get("last-modified");
      const contentLength = response.headers.get("content-length");
      const derived = [lastModified, contentLength].filter(Boolean).join("|");
      if (derived) {
        return normalizeVersion(derived);
      }
    }
  } catch {
    // Fall through to URL-based fallback if HEAD is blocked by CORS policy.
  }

  return normalizeVersion(fileUrl);
}

export default function ReaderPage() {
  const router = useRouter();

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentChapter, setCurrentChapter] = useState("Unknown");
  const [checkpointStatus, setCheckpointStatus] = useState("Highlight your latest word to log progress.");
  const [bookVersion, setBookVersion] = useState("default");
  const [initialPage, setInitialPage] = useState(1);
  const [initialHighlight, setInitialHighlight] = useState<{ pageNumber: number; text: string } | null>(null);
  const [goalRequired, setGoalRequired] = useState(false);
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobileViewport = window.matchMedia("(max-width: 760px)").matches;
      setIsMobile(isMobileViewport);
      setNotesOpen(!isMobileViewport);
    }
  }, []);

  useEffect(() => {
    async function bootstrap() {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        await getMe();

        // Determine current book version before asking for latest progress.
        const version = await detectBookVersion(bookUrl);
        setBookVersion(version || "default");

        const [plan, latest] = await Promise.all([
          getMyReadingPlan(),
          getLatestReadingProgress(version),
        ]);

        setGoalRequired(!plan);
        if (latest) {
          setInitialPage(Math.max(1, latest.page_number));
          setInitialHighlight({
            pageNumber: Math.max(1, latest.page_number),
            text: latest.highlighted_text,
          });
          setCurrentPage(Math.max(1, latest.page_number));
          setCurrentChapter(latest.chapter || "Unknown");
          setCheckpointStatus(
            `Resumed from page ${latest.page_number} (${latest.chapter || "Unknown"}).`,
          );
        } else {
          // No latest returned (either none exists or it was cleared due to book change).
          setInitialPage(1);
          setInitialHighlight(null);
          setCurrentPage(1);
          setCurrentChapter("Unknown");
        }
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearToken();
          router.replace("/login");
          return;
        }

        setCheckpointStatus(
          "Temporary server issue while restoring session. Please retry in a few seconds.",
        );
      } finally {
        setIsCheckingAuth(false);
      }
    }

    void bootstrap();
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    detectBookVersion(bookUrl).then((version) => {
      if (!cancelled) {
        setBookVersion(version || "default");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleProgress(payload: {
    page_number: number;
    chapter: string;
    highlighted_text: string;
    book_version?: string;
    baseline_chapter?: string;
  }) {
    setCurrentPage(payload.page_number);
    setCurrentChapter(payload.chapter || "Unknown");
    setCheckpointStatus("Saving checkpoint...");
    try {
      await updateReadingProgress(payload);
      setCheckpointStatus(
        `Checkpoint saved on page ${payload.page_number} in ${payload.chapter}.`,
      );
    } catch {
      setCheckpointStatus("Could not save checkpoint. Please retry by highlighting again.");
    }
  }

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  function handleGoalSaved() {
    setGoalRequired(false);
    setShowGoalEditor(false);
    setCheckpointStatus("Goal saved. Start reading and highlight your latest line.");
  }

  const statusTone = checkpointStatus.toLowerCase().includes("could not")
    ? styles.statusError
    : checkpointStatus.toLowerCase().includes("saved")
      ? styles.statusOk
      : styles.statusNeutral;

  if (isCheckingAuth) {
    return <main className={styles.loading}>Checking your session...</main>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.topNav}>
        <div className={styles.titleBlock}>
          <p className={styles.kicker}>Reading workspace</p>
          <h1>Focus mode</h1>
        </div>
        <div className={styles.links}>
          <button className={styles.adjustGoalButton} onClick={() => setShowGoalEditor((value) => !value)}>
            {showGoalEditor ? "Close goal" : "Adjust goal"}
          </button>
          <Link href="/">Home</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <button className={styles.logoutButton} onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <section className={styles.metricRow}>
        <div><span>Page</span><strong>{currentPage}</strong></div>
        <div><span>Chapter</span><strong>{currentChapter}</strong></div>
        <div><span>Book version</span><strong>{bookVersion}</strong></div>
      </section>

      <section className={styles.content}>
        <div className={`${styles.viewerColumn} ${goalRequired ? styles.viewerBlocked : ""}`}>
          <PdfReader
            fileUrl={bookUrl}
            initialPage={initialPage}
            initialHighlight={initialHighlight}
            onProgress={(payload) => handleProgress({ ...payload, book_version: bookVersion })}
            onPageFocus={({ pageNumber, chapter }) => {
              setCurrentPage(pageNumber);
              setCurrentChapter(chapter);
            }}
          />
        </div>

        <aside className={`${styles.notesColumn} ${notesOpen ? styles.notesOpen : styles.notesClosed}`}>
          <button className={styles.mobileCloseNotes} onClick={() => setNotesOpen(false)}>
            Hide notes
          </button>
          <div className={styles.checkpointCard}>
            <div className={styles.cardHeader}>
              <h2>Progress integrity</h2>
              <span className={`${styles.statusPill} ${statusTone}`}>Live</span>
            </div>
            <p>{checkpointStatus}</p>
            <p className={styles.bookVersion}>Book version: {bookVersion}</p>
          </div>
          <NotesPanel
            key={`${currentPage}-${bookVersion}`}
            pageNumber={currentPage}
            chapter={currentChapter}
            bookVersion={bookVersion}
          />
        </aside>
      </section>

      {isMobile && notesOpen ? (
        <div
          className={styles.notesBackdrop}
          onClick={() => setNotesOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {isMobile ? (
        <button
          className={styles.mobileNotesCta}
          onClick={() => setNotesOpen((value) => !value)}
          aria-label={notesOpen ? "Hide notes panel" : "Open notes panel"}
        >
          {notesOpen ? "Hide notes" : "Take notes"}
        </button>
      ) : null}

      {(goalRequired || showGoalEditor) ? (
        <section className={styles.goalOverlay}>
          <div className={styles.goalModal}>
            <ReadingGoalForm
              title={goalRequired ? "Set your reading goal to begin" : "Adjust your reading goal"}
              enforceSetup={goalRequired}
              onSaved={handleGoalSaved}
            />
            {!goalRequired ? (
              <button className={styles.dismissGoalModal} onClick={() => setShowGoalEditor(false)}>
                Continue reading
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
