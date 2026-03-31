"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import styles from "./PdfReader.module.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type RawOutlineNode = {
  title?: string;
  dest?: unknown;
  items?: RawOutlineNode[];
};

type PdfDocumentLike = {
  numPages: number;
  getOutline: () => Promise<RawOutlineNode[] | null>;
  getDestination: (destinationName: string) => Promise<unknown[] | null>;
  getPageIndex: (reference: unknown) => Promise<number>;
};

type OutlineEntry = {
  title: string;
  pageNumber: number;
};

type ProgressPayload = {
  page_number: number;
  chapter: string;
  highlighted_text: string;
  baseline_chapter?: string;
};

type PdfReaderProps = {
  fileUrl: string;
  onProgress: (payload: ProgressPayload) => Promise<void>;
  onPageFocus: (payload: { pageNumber: number; chapter: string }) => void;
  initialPage?: number;
  initialHighlight?: { pageNumber: number; text: string } | null;
};

async function resolveDestinationArray(
  pdf: PdfDocumentLike,
  destination: unknown,
): Promise<unknown[] | null> {
  if (!destination) {
    return null;
  }

  if (typeof destination === "string") {
    return pdf.getDestination(destination);
  }

  if (Array.isArray(destination)) {
    return destination;
  }

  return null;
}

async function extractOutlineEntries(pdf: PdfDocumentLike): Promise<OutlineEntry[]> {
  const outline = await pdf.getOutline();
  if (!outline || outline.length === 0) {
    return [];
  }

  const entries: OutlineEntry[] = [];

  async function walk(nodes: RawOutlineNode[]) {
    for (const node of nodes) {
      const destinationArray = await resolveDestinationArray(pdf, node.dest);

      if (destinationArray && destinationArray[0] !== undefined) {
        try {
          const pageIndex = await pdf.getPageIndex(destinationArray[0]);
          entries.push({
            title: node.title?.trim() || "Untitled chapter",
            pageNumber: pageIndex + 1,
          });
        } catch {
          // Skip malformed outline entries.
        }
      }

      if (node.items && node.items.length > 0) {
        await walk(node.items);
      }
    }
  }

  await walk(outline);
  return entries.sort((a, b) => a.pageNumber - b.pageNumber);
}

function resolveChapter(pageNumber: number, entries: OutlineEntry[]): string {
  let activeChapter = "Unknown";
  for (const entry of entries) {
    if (entry.pageNumber <= pageNumber) {
      activeChapter = entry.title;
    } else {
      break;
    }
  }
  return activeChapter;
}

export default function PdfReader({
  fileUrl,
  onProgress,
  onPageFocus,
  initialPage,
  initialHighlight,
}: PdfReaderProps) {
  const [activeFileUrl, setActiveFileUrl] = useState<string>(fileUrl);
  useEffect(() => {
    setActiveFileUrl(fileUrl);
  }, [fileUrl]);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastCheckpointRef = useRef<string>("");

  const [numPages, setNumPages] = useState(0);
  const [focusedPage, setFocusedPage] = useState(1);
  const [outlineEntries, setOutlineEntries] = useState<OutlineEntry[]>([]);
  const [pageTitles, setPageTitles] = useState<Record<number, string>>({});
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [manualHighlight, setManualHighlight] = useState<{
    pageNumber: number;
    text: string;
  } | null>(initialHighlight ?? null);

  const effectiveHighlight = manualHighlight ?? initialHighlight ?? null;

  const chapter = useMemo(() => {
    // Prefer PDF outline entries when available.
    if (outlineEntries && outlineEntries.length > 0) {
      return resolveChapter(focusedPage, outlineEntries);
    }

    // Otherwise fall back to any detected per-page titles discovered
    // from the text layer. Walk backwards from the focused page to find
    // the nearest prior page that contains a discovered title.
    for (let p = focusedPage; p >= 1; p--) {
      const title = pageTitles[p];
      if (title && title.trim().length > 0) {
        return title;
      }
    }

    return "Unknown";
  }, [focusedPage, outlineEntries, pageTitles]);

  useEffect(() => {
    onPageFocus({ pageNumber: focusedPage, chapter });
  }, [chapter, focusedPage, onPageFocus]);

  function onDocumentLoadSuccess(pdf: PdfDocumentLike) {
    setNumPages(pdf.numPages);
    setViewerError(null);

    void extractOutlineEntries(pdf).then((entries) => {
      setOutlineEntries(entries);
    });
  }

  function onDocumentLoadError(error: Error) {
    // Try a local fallback (/book.pdf) if a remote URL failed to load.
    (async () => {
      try {
        if (activeFileUrl !== "/book.pdf") {
          // Check whether a local fallback exists and is reachable.
          const resp = await fetch("/book.pdf", { method: "HEAD" });
          if (resp.ok) {
            console.warn("Remote PDF failed, falling back to /book.pdf");
            setActiveFileUrl("/book.pdf");
            setViewerError(null);
            return;
          }
        }
      } catch {
        // ignore network errors for fallback check
      }

      setViewerError(error.message);
    })();
  }

  const clearPersistentHighlight = useCallback(() => {
    const container = pageContainerRef.current;
    if (!container) {
      return;
    }

    const previous = container.querySelectorAll(".persistent-highlight");
    previous.forEach((node) => node.classList.remove("persistent-highlight"));
  }, []);

  const applyPersistentHighlight = useCallback((pageNumber: number, text: string) => {
    const wrapper = pageRefs.current.get(pageNumber);
    if (!wrapper) {
      return;
    }

    const textLayer = wrapper.querySelector(".react-pdf__Page__textContent");
    if (!textLayer) {
      return;
    }

    const spans = Array.from(textLayer.querySelectorAll("span"));
    if (spans.length === 0) {
      return;
    }

    clearPersistentHighlight();

    const target = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (!target) {
      return;
    }

    const offsets: Array<{ span: HTMLSpanElement; start: number; end: number }> = [];
    let merged = "";

    for (const span of spans) {
      const normalized = (span.textContent ?? "").replace(/\s+/g, " ");
      const start = merged.length;
      merged += normalized;
      offsets.push({ span: span as HTMLSpanElement, start, end: merged.length });
    }

    const index = merged.toLowerCase().indexOf(target);
    if (index < 0) {
      return;
    }

    const end = index + target.length;
    for (const entry of offsets) {
      if (entry.end > index && entry.start < end) {
        entry.span.classList.add("persistent-highlight");
      }
    }
  }, [clearPersistentHighlight]);

  useEffect(() => {
    if (!effectiveHighlight) {
      clearPersistentHighlight();
      return;
    }

    const timer = window.setTimeout(() => {
      applyPersistentHighlight(effectiveHighlight.pageNumber, effectiveHighlight.text);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [applyPersistentHighlight, clearPersistentHighlight, effectiveHighlight]);

  useEffect(() => {
    if (numPages === 0 || !initialPage) {
      return;
    }

    const targetPage = Math.min(Math.max(initialPage, 1), numPages);
    const timer = window.setTimeout(() => {
      const element = pageRefs.current.get(targetPage);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        setFocusedPage(targetPage);
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [initialPage, numPages]);

  useEffect(() => {
    const root = pageContainerRef.current;
    if (!root || numPages === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let topMatch: { page: number; ratio: number } | null = null;

        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const page = Number((entry.target as HTMLElement).dataset.pageNumber);
          if (!Number.isFinite(page)) {
            continue;
          }

          if (!topMatch || entry.intersectionRatio > topMatch.ratio) {
            topMatch = { page, ratio: entry.intersectionRatio };
          }
        }

        if (topMatch) {
          setFocusedPage(topMatch.page);
        }
      },
      {
        root,
        threshold: [0.45, 0.6, 0.75],
      },
    );

    pageRefs.current.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [numPages]);

  async function handleMouseUp() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      return;
    }

    const container = pageContainerRef.current;
    const anchorNode = selection.anchorNode;
    if (!container || !anchorNode || !container.contains(anchorNode)) {
      return;
    }

    const pageElement =
      anchorNode instanceof Element
        ? anchorNode.closest("[data-page-number]")
        : anchorNode.parentElement?.closest("[data-page-number]");
    const highlightedPage = Number(pageElement?.getAttribute("data-page-number") ?? focusedPage);
    const pageNumber = Number.isFinite(highlightedPage) && highlightedPage > 0
      ? highlightedPage
      : focusedPage;
    const highlightedChapter = resolveChapter(pageNumber, outlineEntries);

    const checkpointKey = `${pageNumber}|${highlightedChapter}|${selectedText}`;
    if (checkpointKey === lastCheckpointRef.current) {
      return;
    }

    lastCheckpointRef.current = checkpointKey;
    setManualHighlight({ pageNumber, text: selectedText });

    await onProgress({
      page_number: pageNumber,
      chapter: highlightedChapter,
      highlighted_text: selectedText,
      baseline_chapter: outlineEntries && outlineEntries.length > 0
        ? outlineEntries[0].title
        : pageTitles[1] ?? undefined,
    });

    selection.removeAllRanges();
  }

  return (
    <section className={styles.readerSurface}>
      <div className={styles.chapterBar}>
        <span>Chapter:</span>
        <strong>{chapter}</strong>
        <span className={styles.currentPage}>Page {focusedPage}{numPages ? ` / ${numPages}` : ""}</span>
      </div>

      {viewerError ? (
        <div className={styles.error}>
          {viewerError}. Place your book at /public/book.pdf and refresh.
        </div>
      ) : (
        <div className={styles.pageShell} onMouseUp={handleMouseUp} ref={pageContainerRef}>
          <Document
            file={activeFileUrl}
            onLoadSuccess={(pdf) => onDocumentLoadSuccess(pdf as unknown as PdfDocumentLike)}
            onLoadError={onDocumentLoadError}
          >
            {Array.from({ length: numPages }, (_, index) => {
              const pageNumber = index + 1;
              return (
                <div
                  key={pageNumber}
                  className={styles.pageWrapper}
                  data-page-number={pageNumber}
                  ref={(node) => {
                    if (node) {
                      pageRefs.current.set(pageNumber, node);
                    } else {
                      pageRefs.current.delete(pageNumber);
                    }
                  }}
                >
                  <Page
                    pageNumber={pageNumber}
                    renderTextLayer
                    renderAnnotationLayer={false}
                    width={900}
                    onRenderTextLayerSuccess={() => {
                      if (effectiveHighlight?.pageNumber === pageNumber) {
                        window.setTimeout(() => {
                          applyPersistentHighlight(pageNumber, effectiveHighlight.text);
                        }, 30);
                      }

                      // If the PDF has no outline, attempt to infer a
                      // per-page title from the text layer (helps when the
                      // document lacks bookmarks). This keeps chapter names
                      // from showing as "Unknown".
                      if (outlineEntries.length === 0) {
                        const wrapper = pageRefs.current.get(pageNumber);
                        try {
                          const textLayer = wrapper?.querySelector(
                            ".react-pdf__Page__textContent",
                          );
                          if (textLayer) {
                            const spans = Array.from(
                              textLayer.querySelectorAll("span"),
                            ).map((s) => (s.textContent ?? "").trim());
                            const merged = spans.join(" ").replace(/\s+/g, " ").trim();

                            let candidate = "";
                            // Prefer explicit "Chapter" headings when present.
                            const chapterMatch = merged.match(/\b(CHAPTER|Chapter)\b[:#\s]*\d*/);
                            if (chapterMatch) {
                              // use the first 120 chars as a compact title
                              candidate = merged.slice(0, 120);
                            } else {
                              // fallback: take the first short sentence/line
                              candidate = merged.split(/[\.\n\r]/)[0]?.trim() ?? "";
                            }

                            if (candidate && candidate.length > 3 && candidate.length < 200) {
                              setPageTitles((prev) => {
                                if (prev[pageNumber]) return prev;
                                return { ...prev, [pageNumber]: candidate };
                              });
                            }
                          }
                        } catch {
                          // Best-effort only — ignore DOM issues.
                        }
                      }
                    }}
                  />
                </div>
              );
            })}
          </Document>
        </div>
      )}
    </section>
  );
}
