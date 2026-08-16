import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getAllCourses } from "@/lib/course/data";
import { Panel } from "../ui";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  await requireSession();

  const courses = getAllCourses();

  return (
    <div className="relative space-y-6 max-w-3xl">
      <header className="relative">
        <h1 className="text-xl font-semibold tracking-tight">Training & Onboarding</h1>
        <p className="mt-2 text-sm text-ink-2">
          Complete your onboarding or learn how to sell tax advisory services.
        </p>
      </header>

      <div className="grid gap-3">
        {courses.map((course) => (
          <Link key={course.id} href={`/courses/${course.id}`}>
            <Panel
              title={course.title}
              meta={`${course.sections.reduce((sum, s) => sum + s.subsections.length, 0)} sections`}
              className="hover:bg-hover transition-colors cursor-pointer"
            >
              <p className="text-sm text-ink-2">{course.description}</p>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
