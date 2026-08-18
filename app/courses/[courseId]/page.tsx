import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getCourse } from "@/lib/course/data";
import { getCourseProgress } from "@/lib/course/firestore";
import { Panel } from "../../ui";
import { CoursePlayer } from "./client";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const session = await requireSession();
  const { courseId } = await params;

  const course = await getCourse(courseId);
  if (!course) {
    notFound();
  }

  let progress;
  try {
    progress = await getCourseProgress(session.uid, courseId);
  } catch {
    // If Firestore fails, show empty progress
    progress = new Map();
  }

  return <CoursePlayer course={course} initialProgress={progress} />;
}
