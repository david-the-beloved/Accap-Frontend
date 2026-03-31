"use client";

import { FormEvent, useEffect, useState } from "react";

import { getMyReadingPlan, upsertReadingPlan } from "@/lib/api";
import styles from "./ReadingGoalForm.module.css";

type GoalType = "daily";
type GoalMetric = "pages" | "chapters";

type ReadingGoalFormProps = {
  title?: string;
  enforceSetup?: boolean;
  onSaved?: () => void;
};

export default function ReadingGoalForm({
  title = "Your reading goal",
  enforceSetup = false,
  onSaved,
}: ReadingGoalFormProps) {
  const [goalType] = useState<GoalType>("daily");
  const [goalMetric, setGoalMetric] = useState<GoalMetric>("pages");
  const [pagesGoal, setPagesGoal] = useState(10);
  const [chaptersGoal, setChaptersGoal] = useState(0);
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    let cancelled = false;

    getMyReadingPlan()
      .then((plan) => {
        if (cancelled || !plan) {
          if (!cancelled) {
            setStatus("No plan yet");
          }
          return;
        }

        setPagesGoal(plan.pages_per_day_goal);
        setChaptersGoal(plan.chapters_per_day_goal);
        setGoalMetric(plan.pages_per_day_goal > 0 ? "pages" : "chapters");
        setStatus("Loaded");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("No plan yet");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Saving...");

    try {
      await upsertReadingPlan({
        goal_type: goalType,
        pages_per_day_goal: goalMetric === "pages" ? pagesGoal : 0,
        chapters_per_day_goal: goalMetric === "chapters" ? chaptersGoal : 0,
      });
      setStatus("Saved");
      onSaved?.();
    } catch {
      setStatus("Save failed");
    }
  }

  return (
    <form className={styles.panel} onSubmit={onSubmit}>
      <div className={styles.headingRow}>
        <h2>{title}</h2>
        <span className="status-pill">{status}</span>
      </div>

      {enforceSetup ? (
        <p>
          Choose your goal metric and targets before starting your reading session.
        </p>
      ) : null}

      <label>
        Goal metric
        <select value={goalMetric} onChange={(event) => setGoalMetric(event.target.value as GoalMetric)}>
          <option value="pages">Pages per day</option>
          <option value="chapters">Chapter changes per day</option>
        </select>
      </label>

      {goalMetric === "pages" ? (
        <label>
          Target pages
          <input
            type="number"
            min={0}
            value={pagesGoal}
            onChange={(event) => setPagesGoal(Number(event.target.value))}
          />
        </label>
      ) : (
        <label>
          Target chapter changes
          <input
            type="number"
            min={0}
            value={chaptersGoal}
            onChange={(event) => setChaptersGoal(Number(event.target.value))}
          />
        </label>
      )}

      <button type="submit">Save goal</button>
    </form>
  );
}
