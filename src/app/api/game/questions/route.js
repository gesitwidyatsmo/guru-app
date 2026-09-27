import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

const db = supabaseAdmin;

// GET: Ambil soal berdasarkan package_id
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const packageId = searchParams.get("package_id");

    if (!packageId) {
      return NextResponse.json({ error: "package_id wajib disertakan" }, { status: 400 });
    }

    const { data: questions, error } = await db
      .from("game_questions")
      .select("*")
      .eq("package_id", packageId)
      .order("question_number", { ascending: true });

    if (error) {
      console.warn("GET game_questions error:", error.message);
      return NextResponse.json([]);
    }

    const formatted = (questions || []).map((q) => ({
      id: q.question_number || q.id,
      dbId: q.id,
      packageId: q.package_id,
      topic: q.topic,
      grade: q.grade,
      question: q.question,
      options: q.options || [],
      answer: q.answer,
      explanation: q.explanation || "",
      points: q.points || 10,
    }));

    return NextResponse.json(formatted);
  } catch (err) {
    console.error("Error GET /api/game/questions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Tambah atau bulk upsert soal ke paket
export async function POST(request) {
  try {
    const body = await request.json();

    if (Array.isArray(body)) {
      if (body.length === 0) {
        return NextResponse.json({ error: "Array soal kosong" }, { status: 400 });
      }

      const rows = body.map((q, idx) => ({
        id: q.dbId || `q_${q.package_id || q.packageId}_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
        package_id: q.package_id || q.packageId,
        question_number: q.question_number || q.id || idx + 1,
        topic: q.topic || "Materi Pokok",
        grade: q.grade || "Semua Tingkat",
        question: q.question,
        options: q.options || [],
        answer: q.answer,
        explanation: q.explanation || "",
        points: q.points || 10,
      }));

      const { error } = await db.from("game_questions").upsert(rows, { onConflict: "id" });

      if (error) {
        console.error("Bulk upsert game_questions error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, count: rows.length });
    }

    // Single question
    const {
      package_id, packageId, topic, grade, question,
      options, answer, explanation, points, question_number, dbId,
    } = body;

    const targetPkgId = package_id || packageId;
    if (!targetPkgId || !question || !answer) {
      return NextResponse.json(
        { error: "package_id, question, dan answer wajib diisi" },
        { status: 400 }
      );
    }

    const newId = dbId || `q_${targetPkgId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const { error } = await db.from("game_questions").upsert(
      {
        id: newId,
        package_id: targetPkgId,
        question_number: question_number || 1,
        topic: topic || "Materi Pokok",
        grade: grade || "Semua Tingkat",
        question,
        options: options || [],
        answer,
        explanation: explanation || "",
        points: points || 10,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("Upsert game_questions error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: newId });
  } catch (err) {
    console.error("Error POST /api/game/questions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Update butir soal tertentu
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, dbId, topic, grade, question, options, answer, explanation, points } = body;
    const targetId = dbId || id;

    if (!targetId) {
      return NextResponse.json({ error: "ID soal wajib diisi" }, { status: 400 });
    }

    const { error } = await db
      .from("game_questions")
      .update({ topic, grade, question, options, answer, explanation, points })
      .eq("id", targetId);

    if (error) {
      console.error("PUT game_questions error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error PUT /api/game/questions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Hapus butir soal
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID soal wajib diisi" }, { status: 400 });
    }

    const { error } = await db.from("game_questions").delete().eq("id", id);

    if (error) {
      console.error("DELETE game_questions error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error DELETE /api/game/questions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
