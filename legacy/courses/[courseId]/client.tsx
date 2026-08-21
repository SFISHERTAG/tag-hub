"use client";

import { useState, useCallback } from "react";
import { Fold, Panel } from "../../ui";
import type { Course, Subsection } from "@/lib/course/types";
import type { ProgressDoc } from "@/lib/course/firestore";

type Props = {
  course: Course;
  initialProgress: Map<string, ProgressDoc>;
};

export function CoursePlayer({ course, initialProgress }: Props) {
  const [progress, setProgress] = useState(initialProgress);
  const [saveError, setSaveError] = useState<string | null>(null);

  const getCheckboxState = useCallback(
    (sectionId: string, subsectionId: string, checkboxId: string): boolean => {
      const key = `${sectionId}/${subsectionId}/${checkboxId}`;
      return progress.get(key)?.completed ?? false;
    },
    [progress],
  );

  const handleCheckboxChange = useCallback(
    async (
      sectionId: string,
      subsectionId: string,
      checkboxId: string,
      completed: boolean,
    ) => {
      const key = `${sectionId}/${subsectionId}/${checkboxId}`;

      /*
       * Restore the previous value on failure, rather than deleting the key.
       *
       * The rollback used to `delete` the entry, which is not an undo: it is
       * "no record", and `getCheckboxState` reads that as unchecked. So a
       * failed save while *unchecking* a box the user had genuinely completed
       * erased that completion from the screen. Their real progress was still
       * on the server, but they saw it disappear and had no reason not to
       * redo the work.
       */
      const previous = progress.get(key);

      // Optimistic update
      setProgress((prev) => new Map(prev).set(key, { completed, completedAt: Date.now() }));

      const rollback = () => {
        setProgress((prev) => {
          const next = new Map(prev);
          if (previous === undefined) {
            next.delete(key);
          } else {
            next.set(key, previous);
          }
          return next;
        });
        setSaveError("Couldn't save that change — it has been undone. Check your connection and try again.");
      };

      // Send to server
      try {
        const res = await fetch("/api/courses/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId: course.id,
            sectionId,
            subsectionId,
            checkboxId,
            completed,
          }),
        });

        if (!res.ok) {
          rollback();
          return;
        }
        setSaveError(null);
      } catch {
        rollback();
      }
    },
    [course.id, progress],
  );

  const calculateProgress = useCallback(() => {
    let total = 0;
    let completed = 0;

    for (const section of course.sections) {
      for (const subsection of section.subsections) {
        for (const checkbox of subsection.checkboxes) {
          total++;
          if (getCheckboxState(section.id, subsection.id, checkbox.id)) {
            completed++;
          }
        }
      }
    }

    return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [course, getCheckboxState]);

  const progressStats = calculateProgress();

  return (
    <div className="relative space-y-6 max-w-4xl">
      <header className="relative">
        <h1 className="text-xl font-semibold tracking-tight">{course.title}</h1>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progressStats.percent}%` }}
            />
          </div>
          <span className="text-sm font-medium text-ink-2 whitespace-nowrap">
            {progressStats.completed}/{progressStats.total}
          </span>
        </div>
      </header>

      {saveError && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger"
        >
          {saveError}
        </p>
      )}

      <div className="relative space-y-6">
        {course.sections.map((section) => (
          <div key={section.id} className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">{section.title}</h2>

            <div className="space-y-2">
              {section.subsections.map((subsection) => (
                <SubsectionFold
                  key={subsection.id}
                  section={section}
                  subsection={subsection}
                  progress={progress}
                  getCheckboxState={getCheckboxState}
                  onCheckboxChange={handleCheckboxChange}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubsectionFold({
  section,
  subsection,
  getCheckboxState,
  onCheckboxChange,
}: {
  section: { id: string };
  subsection: Subsection;
  progress: Map<string, ProgressDoc>;
  getCheckboxState: (sectionId: string, subsectionId: string, checkboxId: string) => boolean;
  onCheckboxChange: (
    sectionId: string,
    subsectionId: string,
    checkboxId: string,
    completed: boolean,
  ) => Promise<void>;
}) {
  const allChecked = subsection.checkboxes.every((cb) =>
    getCheckboxState(section.id, subsection.id, cb.id),
  );

  return (
    <Fold
      title={subsection.title}
      meta={
        allChecked ? (
          <span className="text-xs font-medium text-ok">Complete</span>
        ) : (
          <span className="text-xs text-ink-3">
            {subsection.checkboxes.filter((cb) =>
              getCheckboxState(section.id, subsection.id, cb.id),
            ).length}/{subsection.checkboxes.length}
          </span>
        )
      }
    >
      <div className="space-y-4">
        {subsection.loomId && (
          <div className="aspect-video rounded-lg overflow-hidden bg-line">
            <iframe
              src={`https://www.loom.com/embed/${subsection.loomId}`}
              className="w-full h-full"
              title={subsection.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <div className="space-y-3">
          {subsection.checkboxes.map((checkbox) => (
            <label key={checkbox.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={getCheckboxState(section.id, subsection.id, checkbox.id)}
                onChange={(e) =>
                  onCheckboxChange(
                    section.id,
                    subsection.id,
                    checkbox.id,
                    e.target.checked,
                  )
                }
                className="w-4 h-4 rounded border border-line checked:bg-ok checked:border-ok accent-ok"
              />
              <span className="text-sm text-ink-2">{checkbox.label}</span>
            </label>
          ))}
        </div>

        {subsection.content && (
          <Panel glass>
            <div className="prose prose-sm text-ink-2 space-y-3 max-w-none">
              {subsection.content.split("\n\n").map((paragraph, i) => (
                <p key={i} className="whitespace-pre-wrap">
                  {paragraph}
                </p>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </Fold>
  );
}
