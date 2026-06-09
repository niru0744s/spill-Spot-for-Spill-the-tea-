/**
 * services/supabaseService.ts
 * ----------------------------
 * Zero-dependency Supabase Storage upload utility.
 * Decodes base64 image data to a binary buffer and uploads it directly to Supabase Storage.
 * Bypasses the Expo SDK 56 Winter CG fetch 'Unsupported FormDataPart implementation' issue.
 */

export async function uploadProfilePhotoToSupabase(
  base64Data: string,
  uid: string
): Promise<string | null> {
  const supabaseUrl    = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANONKEY;
  const bucket = 'avatars';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[supabaseService] Missing Supabase environment variables');
    return null;
  }

  try {
    const filename  = `${uid}_avatar.jpg`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filename}`;

    // Decode base64 to native Uint8Array binary buffer
    const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    // Always PUT with x-upsert:true — filename is deterministic so this
    // safely creates on first upload and overwrites on every subsequent one.
    // Removes the POST→PUT fallback double-call that was needed before.
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey':        supabaseAnonKey,
        'x-upsert':      'true',
        'Content-Type':  'image/jpeg',
      },
      body: buffer,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Avatar upload failed: ${errText}`);
    }

    // Return the deterministic public access URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filename}`;
    return publicUrl;
  } catch (error) {
    console.error('[supabaseService] Error in uploadProfilePhotoToSupabase:', error);
    throw error;
  }
}

export async function uploadGroupPhotoToSupabase(
  base64Data: string,
  groupId: string
): Promise<string | null> {
  const supabaseUrl    = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANONKEY;
  const bucket = 'avatars';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[supabaseService] Missing Supabase environment variables');
    return null;
  }

  try {
    const filename  = `group_${groupId}.jpg`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filename}`;

    // Decode base64 to native Uint8Array binary buffer
    const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey':        supabaseAnonKey,
        'x-upsert':      'true',
        'Content-Type':  'image/jpeg',
      },
      body: buffer,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Group avatar upload failed: ${errText}`);
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filename}`;
    return publicUrl;
  } catch (error) {
    console.error('[supabaseService] Error in uploadGroupPhotoToSupabase:', error);
    throw error;
  }
}
