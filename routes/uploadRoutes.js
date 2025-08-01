// File: routes/uploadRoutes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { verifyToken, requireAdminWithActiveCompany } = require('../middleware/auth'); // Your authentication middleware
const uploadController = require('../controllers/uploadController');

// --- Multer Storage Configuration (This is the "brain" of the upload process) ---
const storage = multer.diskStorage({
    /**
     * destination: A function that tells Multer where to save the file.
     * This logic makes the path work both locally and in production.
     */
    destination: function (req, file, cb) {
        // Define the base path. In production, this is the Docker Volume path.
        // For local development, it's a folder in your project.
        const basePath = process.env.NODE_ENV === 'production' 
            ? '/usr/src/app/uploads' 
            : path.join(process.cwd(), 'uploads');

        // Create organized subfolders based on a type sent from the frontend.
        // This is a great practice to keep your uploads tidy.
        // e.g., /uploads/voice-notes, /uploads/profile-pictures, /uploads/receipts
        const uploadType = req.body.uploadType || 'general'; // Default to 'general' if not specified
        const uploadPath = path.join(basePath, uploadType);

        // Ensure the directory exists before saving the file.
        fs.mkdirSync(uploadPath, { recursive: true });
        
        // Tell Multer to save the file in this calculated path.
        cb(null, uploadPath);
    },
    /**
     * filename: A function that tells Multer what to name the file.
     * We create a unique name to prevent files from being overwritten.
     */
    filename: function (req, file, cb) {
        const uniqueSuffix = uuidv4(); // Generate a unique UUID
        const fileExtension = path.extname(file.originalname); // Get the original file extension (e.g., '.mp3', '.jpg')
        cb(null, `${uniqueSuffix}${fileExtension}`); // Final filename: e.g., 'a1b2c3d4-e5f6....mp3'
    }
});

// Initialize Multer with our storage configuration
const upload = multer({ storage: storage });

// --- Define the API Route ---
// @route   POST /api/uploads
// @desc    Upload a single file to the server's persistent storage.
// @access  Private
router.post(
    '/', 
    verifyToken, // First, run authentication middleware
    upload.single('file'), // Next, run the Multer middleware to process a single file from a form field named "file"
    uploadController.handleUpload // Finally, if the upload was successful, run our controller
);

module.exports = router;