import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function serverAdmin() {
  // Use service role to bypass RLS — public form is gated by share-link token.
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const getPublicForm = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string; studentId?: string }) => data)
  .handler(async ({ data }) => {
    const sb = serverAdmin();
    const { data: link, error: linkErr } = await sb
      .from("share_links")
      .select("class_id, classes(name)")
      .eq("token", data.token)
      .maybeSingle();
    if (linkErr || !link) return { ok: false as const, error: "Invalid link" };

    const classId = link.class_id;
    const className = (link.classes as { name: string } | null)?.name ?? "Class";

    const { data: students } = await sb
      .from("students")
      .select("id, name")
      .eq("class_id", classId)
      .order("sort_order");

    const { data: submissions } = await sb
      .from("submissions")
      .select("student_id, submitted_at")
      .eq("class_id", classId);

    return {
      ok: true as const,
      className,
      students: students ?? [],
      submissions: submissions ?? [],
      myPrefs: [],
    };
  });

export const submitPublicForm = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      token: string;
      studentId: string;
      preferences: { targetId: string; kind: "with" | "avoid" }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const sb = serverAdmin();
    const { data: link } = await sb
      .from("share_links")
      .select("class_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!link) return { ok: false as const, error: "Invalid link" };
    const classId = link.class_id;

    // Verify the student belongs to this class
    const { data: student } = await sb
      .from("students")
      .select("id")
      .eq("id", data.studentId)
      .eq("class_id", classId)
      .maybeSingle();
    if (!student) return { ok: false as const, error: "Student not in class" };

    // Upsert submission
    const { data: sub, error: subErr } = await sb
      .from("submissions")
      .upsert(
        { class_id: classId, student_id: data.studentId, submitted_at: new Date().toISOString() },
        { onConflict: "class_id,student_id" },
      )
      .select("id")
      .single();
    if (subErr || !sub) return { ok: false as const, error: subErr?.message ?? "Failed" };

    // Replace preferences
    await sb.from("preferences").delete().eq("submission_id", sub.id);
    const rows = data.preferences
      .filter((p) => p.targetId !== data.studentId && (p.kind === "with" || p.kind === "avoid"))
      .map((p) => ({ submission_id: sub.id, target_student_id: p.targetId, kind: p.kind }));
    if (rows.length > 0) {
      const { error: prefErr } = await sb.from("preferences").insert(rows);
      if (prefErr) return { ok: false as const, error: prefErr.message };
    }
    return { ok: true as const };
  });
