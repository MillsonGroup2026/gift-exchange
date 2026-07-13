import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicOrigin } from "@/lib/site-url";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const origin = getPublicOrigin(request);
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
