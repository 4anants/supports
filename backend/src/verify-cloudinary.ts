import 'dotenv/config';
import cloudinary from './lib/cloudinary';
import { Readable } from 'stream';

async function verify() {
    console.log('☁️ Verifying Cloudinary Connection...');
    try {
        const result: any = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'support-portal/test',
                    resource_type: 'raw',
                    public_id: 'test_upload_' + Date.now()
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            Readable.from(Buffer.from('Hello Cloudinary!')).pipe(uploadStream);
        });

        console.log('✅ Upload Successful!');
        console.log('   URL:', result.secure_url);
        console.log('   Public ID:', result.public_id);
    } catch (error: any) {
        console.error('❌ Cloudinary Error:', error.message);
        process.exit(1);
    }
}

verify();
