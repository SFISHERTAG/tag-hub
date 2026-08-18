import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { listCourseSummaries } from "@/lib/course/db";

export const dynamic = "force-dynamic";

export default async function CoursesAdminPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  if (session.currentRole !== "admin") {
    return (
      <div className="max-w-2xl rounded-lg border border-danger/30 bg-danger-tint p-6 text-danger">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only admins can manage courses.</p>
      </div>
    );
  }

  const courses = await listCourseSummaries();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Courses</h1>
        <span className="text-sm text-ink-3">
          {courses.length} {courses.length === 1 ? "course" : "courses"}
        </span>
      </div>

      <div className="divide-y divide-line rounded-lg border border-line">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/admin/courses/${course.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-hover"
          >
            <div>
              <p className="text-sm font-medium text-ink">{course.title}</p>
              <p className="text-xs text-ink-3">{course.description}</p>
            </div>
            <span className="font-mono text-xs text-ink-3">{course.slug}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
