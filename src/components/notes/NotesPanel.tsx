"use client";

import { ChangeEvent, useEffect, useState } from "react";

import { downloadNotesPdf, getNoteByPage, upsertNote } from "@/lib/api";
import styles from "./NotesPanel.module.css";

type NotesPanelProps = {
  pageNumber: number;
  chapter: string;
  bookVersion: string;
};

type SaveStatus = "Loading..." | "Typing..." | "Saving..." | "Saved" | "Save failed";

export default function NotesPanel({ pageNumber, chapter, bookVersion }: NotesPanelProps) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<SaveStatus>("Loading...");
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const [isHydrating, setIsHydrating] = useState(true);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getNoteByPage(pageNumber, bookVersion)
      .then((note) => {
        if (cancelled) {
          return;
        }
        setContent(note?.content ?? "");
        setDirtyVersion(0);
        setStatus("Saved");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setContent("");
        setStatus("Saved");
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydrating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookVersion, pageNumber]);

  useEffect(() => {
    if (isHydrating || dirtyVersion === 0) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setStatus("Saving...");
      try {
        await upsertNote({
          page_number: pageNumber,
          chapter,
          content,
          book_version: bookVersion,
        });
        setStatus("Saved");
      } catch {
        setStatus("Save failed");
      }
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [bookVersion, chapter, content, dirtyVersion, isHydrating, pageNumber]);

  function onChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setContent(event.target.value);
    setStatus("Typing...");
    setDirtyVersion((value) => value + 1);
  }

  async function onDownloadPdf() {
    setDownloadStatus("Preparing PDF...");
    try {
      const blob = await downloadNotesPdf(bookVersion);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `notes-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setDownloadStatus("Downloaded");
    } catch {
      setDownloadStatus("Download failed");
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.meta}>
        <div>
          <p className={styles.label}>Page</p>
          <strong>{pageNumber}</strong>
        </div>
        <div>
          <p className={styles.label}>Chapter</p>
          <strong>{chapter}</strong>
        </div>
      </div>

      <div className={styles.statusRow}>
        <span>Notes auto-save</span>
        {/* status may change after hydration; avoid React hydration mismatch warnings */}
        <span className="status-pill" suppressHydrationWarning>{status}</span>
      </div>

      <div className={styles.exportRow}>
        <button type="button" onClick={onDownloadPdf}>Download notes PDF</button>
        {downloadStatus ? (
          <span className="status-pill" suppressHydrationWarning>{downloadStatus}</span>
        ) : null}
      </div>

      {/* textarea content is fetched client-side and can differ from server HTML; suppress hydration warning */}
      <textarea
        value={content}
        onChange={onChange}
        placeholder="Write your observations, quotes, and commitments here..."
        suppressHydrationWarning
      />
    </section>
  );
}
