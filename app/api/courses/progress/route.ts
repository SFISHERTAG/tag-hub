import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { updateCheckboxProgress } from "@/lib/course/firestore";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const {
      courseId,
      sectionId,
      subsectionId,
      checkboxId,
      completed,
    } = body;

    if (!courseId || !sectionId || !subsectionId || !checkboxId || typeof completed !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await updateCheckboxProgress(
      session.uid,
      courseId,
      sectionId,
      subsectionId,
      checkboxId,
      completed,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Course progress update failed:", error);
    return NextResponse.json(
      { error: "Could not update progress" },
      { status: 500 },
    );
  }
}
