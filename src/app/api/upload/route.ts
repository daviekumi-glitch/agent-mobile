import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/upload
 *
 * Accepts multipart form data with a single `file` field, uploads it to the
 * `attachments` bucket under the caller's own uid folder, and returns the
 * public URL plus metadata for the chat request.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds the 10 MB limit" }, { status: 413 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from("attachments")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("attachments").getPublicUrl(path);

  // Inline small text files so the read_file tool works without a round trip.
  let text: string | undefined;
  const isText =
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    /\.(md|txt|csv|json|ts|tsx|js|jsx|py|sql|yml|yaml|toml)$/i.test(file.name);
  if (isText && file.size <= 256 * 1024) {
    text = await file.text();
  }

  return NextResponse.json({
    attachment: {
      id: crypto.randomUUID(),
      name: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      url: publicUrl,
      text,
    },
  });
}
