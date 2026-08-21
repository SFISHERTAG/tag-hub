import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getCourseById } from "@/lib/course/db";
import { CourseEditor } from "./course-editor";

export const dynamic = "force-dynamic";

export default async function CourseAdminPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  if (session.currentRole !== "admin") {
    return (
      <div className="max-w-2xl rounded-lg border border-danger/30 bg-danger-tint p-6 text-danger">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only admins can edit courses.</p>
      </div>
    );
  }

  const { courseId } = await params;
  const course = await getCourseById(courseId);
  if (!course) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/courses" className="text-xs text-ink-3 hover:text-ink-2">
          ← Courses
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{course.title}</h1>
      </div>

      <CourseEditor courseId={courseId} course={course} />
    </div>
  );
}
