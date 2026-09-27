import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

const db = supabaseAdmin;

// GET: Ambil semua sesi permainan
export async function GET() {
  try {
    const { data: sessions, error } = await db
      .from("game_sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("GET game_sessions error:", error.message);
      return NextResponse.json([]);
    }

    const formatted = (sessions || []).map((s) => ({
      id: s.id,
      createdAt: s.created_at,
      packageId: s.package_id,
      packageName: s.package_name,
      subject: s.subject,
      grade: s.grade,
      materi: s.materi,
      config: {
        gameTitle: s.game_title,
        subTitle: s.sub_title,
        tagline: s.tagline,
        className: s.class_name,
        teacherName: s.teacher_name,
      },
      totalQuestions: s.total_questions,
      teamCount: s.team_count,
      teams: s.teams || [],
      tileStates: s.tile_states || {},
      arenaSeconds: s.arena_seconds || 0,
      gameStatus: s.game_status || "idle",
      totalStudents: s.total_students || 0,
      lastPlayed: s.updated_at || s.created_at,
    }));

    return NextResponse.json(formatted);
  } catch (err) {
    console.error("Error GET /api/game/sessions:", err);
    return NextResponse.json([]);
  }
}

// POST: Buat atau update sesi permainan (upsert)
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      id, packageId, packageName, subject, grade, materi,
      config, totalQuestions, teams, tileStates,
      arenaSeconds, gameStatus, totalStudents,
    } = body;

    const sessionId = id || `game_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const row = {
      id: sessionId,
      package_id: packageId || null,
      package_name: packageName || "Game",
      subject: subject || "Umum",
      grade: grade || "Semua Tingkat",
      materi: materi || "",
      class_name: config?.className || "Kelas",
      teacher_name: config?.teacherName || "Guru",
      game_title: config?.gameTitle || "ARENA OF CHAMPION",
      sub_title: config?.subTitle || "",
      tagline: config?.tagline || "",
      total_questions: totalQuestions || 100,
      team_count: teams?.length || 6,
      teams: teams || [],
      tile_states: tileStates || {},
      arena_seconds: arenaSeconds || 0,
      game_status: gameStatus || "idle",
      total_students: totalStudents || 0,
      updated_at: new Date().toISOString(),
    };

    const { error } = await db.from("game_sessions").upsert(row, { onConflict: "id" });

    if (error) {
      console.error("Upsert game_sessions error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: sessionId });
  } catch (err) {
    console.error("Error POST /api/game/sessions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Update progres permainan (skor, tile, status, timer)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, teams, tileStates, arenaSeconds, gameStatus, config } = body;

    if (!id) {
      return NextResponse.json({ error: "ID sesi wajib diisi" }, { status: 400 });
    }

    const payload = { updated_at: new Date().toISOString() };
    if (teams !== undefined) payload.teams = teams;
    if (tileStates !== undefined) payload.tile_states = tileStates;
    if (arenaSeconds !== undefined) payload.arena_seconds = arenaSeconds;
    if (gameStatus !== undefined) payload.game_status = gameStatus;
    if (config !== undefined) {
      if (config.gameTitle) payload.game_title = config.gameTitle;
      if (config.subTitle) payload.sub_title = config.subTitle;
      if (config.tagline) payload.tagline = config.tagline;
      if (config.className) payload.class_name = config.className;
      if (config.teacherName) payload.teacher_name = config.teacherName;
    }

    const { error } = await db.from("game_sessions").update(payload).eq("id", id);

    if (error) {
      console.error("PUT game_sessions error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error PUT /api/game/sessions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Hapus sesi permainan
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID sesi wajib diisi" }, { status: 400 });
    }

    const { error } = await db.from("game_sessions").delete().eq("id", id);

    if (error) {
      console.error("DELETE game_sessions error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error DELETE /api/game/sessions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
