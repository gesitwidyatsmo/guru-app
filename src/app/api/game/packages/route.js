import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

// Selalu pakai service role — autentikasi sudah divalidasi di halaman (middleware/page)
// Service role bypass RLS sehingga INSERT/UPDATE/DELETE tidak diblokir
const db = supabaseAdmin;

// GET: Ambil seluruh paket bank soal dari database
export async function GET() {
  try {
    const { data: packages, error } = await db
      .from("game_packages")
      .select("*, questions:game_questions(*)")
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("GET game_packages error:", error.message);
      return NextResponse.json([]);
    }

    if (!packages || packages.length === 0) return NextResponse.json([]);

    const formatted = packages.map((p) => ({
      id: p.id,
      name: p.name,
      subject: p.subject,
      grade: p.grade,
      materi: p.materi,
      icon: p.icon,
      gameTitle: p.game_title,
      tagline: p.tagline,
      subTitle: p.sub_title,
      questions: (p.questions || []).map((q) => ({
        id: q.question_number || q.id,
        dbId: q.id,
        topic: q.topic,
        grade: q.grade,
        question: q.question,
        options: q.options || [],
        answer: q.answer,
        explanation: q.explanation,
        points: q.points,
      })),
    }));

    return NextResponse.json(formatted);
  } catch (err) {
    console.error("Error GET /api/game/packages:", err);
    return NextResponse.json([]);
  }
}

// POST: Buat atau update paket bank soal (upsert by id)
export async function POST(request) {
  try {
    const body = await request.json();
    const { id, name, subject, grade, materi, icon, gameTitle, tagline, subTitle, questions } = body;

    if (!name) {
      return NextResponse.json({ error: "Nama paket wajib diisi" }, { status: 400 });
    }

    const pkgId = id || `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const row = {
      id: pkgId,
      name,
      subject: subject || "Umum",
      grade: grade || "Semua Tingkat",
      materi: materi || "",
      icon: icon || "📚",
      game_title: gameTitle || `${name.toUpperCase()} OF CHAMPION`,
      tagline: tagline || "Think Fast. Solve Smart. Become the Champion!",
      sub_title: subTitle || "",
      updated_at: new Date().toISOString(),
    };

    const { error: pkgError } = await db
      .from("game_packages")
      .upsert(row, { onConflict: "id" });

    if (pkgError) {
      console.error("Upsert game_packages error:", pkgError.message);
      return NextResponse.json({ error: pkgError.message }, { status: 500 });
    }

    // Jika ada questions yang disertakan, upsert sekaligus
    if (Array.isArray(questions) && questions.length > 0) {
      const qRows = questions.map((q, idx) => ({
        id: q.dbId || `q_${pkgId}_${q.id || idx + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        package_id: pkgId,
        question_number: q.id || idx + 1,
        topic: q.topic || materi || "Materi Pokok",
        grade: q.grade || grade || "Semua Tingkat",
        question: q.question,
        options: q.options || [],
        answer: q.answer,
        explanation: q.explanation || "",
        points: q.points || 10,
      }));

      const { error: qError } = await db
        .from("game_questions")
        .upsert(qRows, { onConflict: "id" });

      if (qError) {
        console.error("Upsert game_questions error:", qError.message);
      }
    }

    return NextResponse.json({ success: true, id: pkgId });
  } catch (err) {
    console.error("Error POST /api/game/packages:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Update metadata paket saja
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, subject, grade, materi, icon, gameTitle, tagline, subTitle } = body;

    if (!id) {
      return NextResponse.json({ error: "ID paket wajib diisi" }, { status: 400 });
    }

    const payload = { updated_at: new Date().toISOString() };
    if (name !== undefined) payload.name = name;
    if (subject !== undefined) payload.subject = subject;
    if (grade !== undefined) payload.grade = grade;
    if (materi !== undefined) payload.materi = materi;
    if (icon !== undefined) payload.icon = icon;
    if (gameTitle !== undefined) payload.game_title = gameTitle;
    if (tagline !== undefined) payload.tagline = tagline;
    if (subTitle !== undefined) payload.sub_title = subTitle;

    const { error } = await db.from("game_packages").update(payload).eq("id", id);

    if (error) {
      console.error("PUT game_packages error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error PUT /api/game/packages:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Hapus paket (cascade otomatis ke game_questions via FK)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID paket wajib diisi" }, { status: 400 });
    }

    const { error } = await db.from("game_packages").delete().eq("id", id);

    if (error) {
      console.error("DELETE game_packages error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error DELETE /api/game/packages:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
