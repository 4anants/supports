"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// Mock Cloudinary interface for local operation
const localUpload = {
    uploader: {
        upload_stream: (options, callback) => {
            // This is a stub. The actual upload logic is handled in the route now.
            // We return a stream to satisfy the interface if needed, but the route
            // should check for local mode and handle it directly.
            const { PassThrough } = require('stream');
            const stream = new PassThrough();
            setTimeout(() => {
                callback(new Error("Cloudinary is disabled. Use local uploads."), null);
            }, 10);
            return stream;
        }
    },
    config: () => { }
};

exports.default = localUpload;