import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getUserData } from "@/lib/data";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { displayName, athleteProfile, goals } = await req.json();

  if (!displayName?.trim()) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  const db = getUserData(session.userId);
  db.writeUserProfile({ displayName, athleteProfile, goals: goals ?? [] });

  return NextResponse.json({ ok: true });
}
