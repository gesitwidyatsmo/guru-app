import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL atau NEXT_PUBLIC_SUPABASE_ANON_KEY belum diset di .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Uploads a file buffer to Supabase Storage
 * @param {string} bucketName - The name of the storage bucket (e.g. 'tugas-siswa')
 * @param {string} filePath - The path/name of the file in the bucket (e.g. 'infor/123_tugas.pdf')
 * @param {Buffer|ArrayBuffer} fileBuffer - The actual file data
 * @param {string} contentType - The MIME type of the file
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
export const uploadFileToSupabase = async (bucketName, filePath, fileBuffer, contentType) => {
	const { data, error } = await supabase.storage
		.from(bucketName)
		.upload(filePath, fileBuffer, {
			contentType,
			upsert: false, // Don't overwrite if file with same name exists
		});

	if (error) {
		console.error('Supabase upload error:', error);
		throw new Error(error.message);
	}

	// Dapatkan public URL dari file yang baru saja diupload
	const { data: publicUrlData } = supabase.storage
		.from(bucketName)
		.getPublicUrl(data.path);

	return publicUrlData.publicUrl;
};
