"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cloudinary_1 = __importDefault(require("./lib/cloudinary"));
const stream_1 = require("stream");
async function verify() {
    console.log('☁️ Verifying Cloudinary Connection...');
    try {
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.default.uploader.upload_stream({
                folder: 'support-portal/test',
                resource_type: 'raw',
                public_id: 'test_upload_' + Date.now()
            }, (error, result) => {
                if (error)
                    reject(error);
                else
                    resolve(result);
            });
            stream_1.Readable.from(Buffer.from('Hello Cloudinary!')).pipe(uploadStream);
        });
        console.log('✅ Upload Successful!');
        console.log('   URL:', result.secure_url);
        console.log('   Public ID:', result.public_id);
    }
    catch (error) {
        console.error('❌ Cloudinary Error:', error.message);
        process.exit(1);
    }
}
verify();
//# sourceMappingURL=verify-cloudinary.js.map