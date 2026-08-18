"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Course, Section, Subsection } from "@/lib/course/types";
import {
  updateCourseMetaAction,
  createSectionAction,
  updateSectionAction,
  deleteSectionAction,
  createSubsectionAction,
  updateSubsectionAction,
  deleteSubsectionAction,
  createCheckboxAction,
  updateCheckboxAction,
  deleteCheckboxAction,
} from "./actions";

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder-ink-3 focus:border-accent focus:outline-none";
const buttonClass =
  "rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-hover disabled:opacity-50";
const dangerButtonClass =
  "rounded-md border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-tint disabled:opacity-50";

export function CourseEditor({ courseId, course }: { courseId: string; course: Course }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Course meta */}
      <div className="space-y-3 rounded-lg border border-line p-4">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-2">Title</span>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-2">Description</span>
          <input
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button
          className={buttonClass}
          disabled={pending}
          onClick={() => run(() => updateCourseMetaAction(courseId, title, description))}
        >
          Save
        </button>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-2">Sections</h2>

        {course.sections.map((section) => (
          <SectionEditor
            key={section.id}
            courseId={courseId}
            section={section}
            expanded={expanded.has(section.id)}
            onToggle={() => toggle(section.id)}
            pending={pending}
            run={run}
            expandedIds={expanded}
            onToggleId={toggle}
          />
        ))}

        <div className="flex gap-2 rounded-lg border border-dashed border-line p-3">
          <input
            className={inputClass}
            placeholder="New section title"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
          />
          <button
            className={buttonClass}
            disabled={pending || !newSectionTitle.trim()}
            onClick={() =>
              run(async () => {
                const result = await createSectionAction(courseId, newSectionTitle);
                if (result.ok) setNewSectionTitle("");
                return result;
              })
            }
          >
            Add section
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionEditor({
  courseId,
  section,
  expanded,
  onToggle,
  pending,
  run,
  expandedIds,
  onToggleId,
}: {
  courseId: string;
  section: Section;
  expanded: boolean;
  onToggle: () => void;
  pending: boolean;
  run: (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
  expandedIds: Set<string>;
  onToggleId: (id: string) => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [newSubsectionTitle, setNewSubsectionTitle] = useState("");

  return (
    <div className="rounded-lg border border-line">
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={onToggle}
          className="flex-1 text-left text-sm font-medium text-ink hover:text-accent"
        >
          {expanded ? "▾" : "▸"} {section.title}
          <span className="ml-2 text-xs text-ink-3">
            {section.subsections.length} {section.subsections.length === 1 ? "lesson" : "lessons"}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-line p-3">
          <div className="flex gap-2">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
            <button
              className={buttonClass}
              disabled={pending}
              onClick={() => run(() => updateSectionAction(courseId, section.id, title))}
            >
              Save
            </button>
            <button
              className={dangerButtonClass}
              disabled={pending}
              onClick={() => {
                if (confirm(`Delete section "${section.title}" and all its lessons?`)) {
                  run(() => deleteSectionAction(courseId, section.id));
                }
              }}
            >
              Delete section
            </button>
          </div>

          <div className="space-y-2 pl-4">
            {section.subsections.map((subsection) => (
              <SubsectionEditor
                key={subsection.id}
                courseId={courseId}
                subsection={subsection}
                expanded={expandedIds.has(subsection.id)}
                onToggle={() => onToggleId(subsection.id)}
                pending={pending}
                run={run}
              />
            ))}

            <div className="flex gap-2 rounded-md border border-dashed border-line p-2">
              <input
                className={inputClass}
                placeholder="New lesson title"
                value={newSubsectionTitle}
                onChange={(e) => setNewSubsectionTitle(e.target.value)}
              />
              <button
                className={buttonClass}
                disabled={pending || !newSubsectionTitle.trim()}
                onClick={() =>
                  run(async () => {
                    const result = await createSubsectionAction(
                      courseId,
                      section.id,
                      newSubsectionTitle,
                    );
                    if (result.ok) setNewSubsectionTitle("");
                    return result;
                  })
                }
              >
                Add lesson
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubsectionEditor({
  courseId,
  subsection,
  expanded,
  onToggle,
  pending,
  run,
}: {
  courseId: string;
  subsection: Subsection;
  expanded: boolean;
  onToggle: () => void;
  pending: boolean;
  run: (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
}) {
  const [title, setTitle] = useState(subsection.title);
  const [loomId, setLoomId] = useState(subsection.loomId || "");
  const [content, setContent] = useState(subsection.content);
  const [newCheckboxLabel, setNewCheckboxLabel] = useState("");

  return (
    <div className="rounded-md border border-line">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 text-left text-sm text-ink hover:text-accent"
      >
        {expanded ? "▾" : "▸"} {subsection.title}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-line p-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-2">Title</span>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-2">Loom video ID</span>
            <input
              className={inputClass}
              placeholder="e.g. fdba6345d0cb4175baa850e81066216f"
              value={loomId}
              onChange={(e) => setLoomId(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-2">Content</span>
            <textarea
              className={`${inputClass} min-h-32 font-mono text-xs`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>

          <div className="flex gap-2">
            <button
              className={buttonClass}
              disabled={pending}
              onClick={() =>
                run(() =>
                  updateSubsectionAction(courseId, subsection.id, { title, loomId, content }),
                )
              }
            >
              Save
            </button>
            <button
              className={dangerButtonClass}
              disabled={pending}
              onClick={() => {
                if (confirm(`Delete lesson "${subsection.title}"?`)) {
                  run(() => deleteSubsectionAction(courseId, subsection.id));
                }
              }}
            >
              Delete lesson
            </button>
          </div>

          <div className="space-y-1 border-t border-line pt-3">
            <span className="text-xs font-medium text-ink-2">Checkboxes</span>
            {subsection.checkboxes.map((checkbox) => (
              <CheckboxEditor
                key={checkbox.id}
                courseId={courseId}
                checkboxId={checkbox.id}
                label={checkbox.label}
                pending={pending}
                run={run}
              />
            ))}
            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="New checkbox label"
                value={newCheckboxLabel}
                onChange={(e) => setNewCheckboxLabel(e.target.value)}
              />
              <button
                className={buttonClass}
                disabled={pending || !newCheckboxLabel.trim()}
                onClick={() =>
                  run(async () => {
                    const result = await createCheckboxAction(
                      courseId,
                      subsection.id,
                      newCheckboxLabel,
                    );
                    if (result.ok) setNewCheckboxLabel("");
                    return result;
                  })
                }
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckboxEditor({
  courseId,
  checkboxId,
  label,
  pending,
  run,
}: {
  courseId: string;
  checkboxId: string;
  label: string;
  pending: boolean;
  run: (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
}) {
  const [value, setValue] = useState(label);

  return (
    <div className="flex gap-2">
      <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} />
      <button
        className={buttonClass}
        disabled={pending}
        onClick={() => run(() => updateCheckboxAction(courseId, checkboxId, value))}
      >
        Save
      </button>
      <button
        className={dangerButtonClass}
        disabled={pending}
        onClick={() => run(() => deleteCheckboxAction(courseId, checkboxId))}
      >
        ✕
      </button>
    </div>
  );
}
