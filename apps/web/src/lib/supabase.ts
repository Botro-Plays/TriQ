import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[TriQ] Supabase env vars not set — KYC file uploads will not work. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const KYC_BUCKET = 'kyc-documents';

export async function uploadKycFile(
  file: File,
  userId: string,
  docType: string,
): Promise<string | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Contact support.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const path = `${userId}/${docType}_${timestamp}_${random}.${ext}`;

  const { error } = await supabase.storage
    .from(KYC_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(KYC_BUCKET)
    .getPublicUrl(path);

  return urlData.publicUrl;
}
