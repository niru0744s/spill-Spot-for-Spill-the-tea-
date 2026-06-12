/**
 * services/supabaseService.ts
 * ----------------------------
 * Zero-dependency Supabase Storage upload utility.
 * Decodes base64 image data to a binary buffer and uploads it directly to Supabase Storage.
 * Bypasses the Expo SDK 56 Winter CG fetch 'Unsupported FormDataPart implementation' issue.
 */
import { File, UploadType } from 'expo-file-system';
import { Platform } from 'react-native';

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

export async function uploadMediaToSupabase(
  localUri: string,
  filename: string,
  mimeType: string
): Promise<string | null> {
  const supabaseUrl    = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANONKEY;
  const bucket = 'media';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[supabaseService] Missing Supabase environment variables');
    return null;
  }

  try {
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filename}`;

    if (Platform.OS === 'web') {
      // Fetch the Object URL/Local URI to get the binary Blob in browser memory
      const blobResponse = await fetch(localUri);
      const blob = await blobResponse.blob();

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey':        supabaseAnonKey,
          'x-upsert':      'true',
          'Content-Type':  mimeType,
        },
        body: blob,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Web media upload failed with status ${response.status}: ${errText}`);
      }
    } else {
      // Mobile native binary stream
      const file = new File(localUri);
      const response = await file.upload(uploadUrl, {
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey':        supabaseAnonKey,
          'x-upsert':      'true',
          'Content-Type':  mimeType,
        },
        httpMethod: 'PUT',
        uploadType: UploadType.BINARY_CONTENT,
      });

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Media upload failed with status ${response.status}: ${response.body}`);
      }
    }

    // Return the public download URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filename}`;
    return publicUrl;
  } catch (error) {
    console.error('[supabaseService] Error in uploadMediaToSupabase:', error);
    throw error;
  }
}

export async function deleteMediaFromSupabase(
  filename: string
): Promise<boolean> {
  const supabaseUrl    = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANONKEY;
  const bucket = 'media';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[supabaseService] Missing Supabase environment variables');
    return false;
  }

  try {
    const deleteUrl = `${supabaseUrl}/storage/v1/object/${bucket}`;

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey':        supabaseAnonKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        prefixes: [filename],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[supabaseService] Delete media failed:', errText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[supabaseService] Error in deleteMediaFromSupabase:', error);
    return false;
  }
}
