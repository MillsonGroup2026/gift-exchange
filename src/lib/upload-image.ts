import { createClient } from "@/lib/supabase/client";

const BUCKET = "item-images";
const MAX_BYTES = 15 * 1024 * 1024; // matches the bucket's file_size_limit

// Upload an item/sub-item photo to Storage and return its public URL.
// Files go under {uid}/… so the owner-scoped write policy applies.
export async function uploadItemImage(file: File): Promise<{ url?: string; error?: string }> {
  if (!file.type.startsWith("image/")) return { error: "Please choose an image file." };
  if (file.size > MAX_BYTES) return { error: "That image is over 15 MB — please pick a smaller one." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in to add a photo." };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) return { error: error.message };

  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}
