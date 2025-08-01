// File: controllers/uploadController.js

/**
 * Handles the request AFTER a file has been successfully uploaded by Multer.
 * It constructs and sends back the public URL of the saved file.
 */
exports.handleUpload = (req, res) => {
    // 1. Check if Multer successfully processed a file.
    // Multer attaches the file details to the `req.file` object.
    if (!req.file) {
        return res.status(400).json({ error: 'No file was provided in the request.' });
    }

    // 2. Construct the public URL for the file.
    // This URL needs to match how you set up your static file server in `server.js`.
    // Example: The file is saved at '/usr/src/app/uploads/voice-notes/some-file.mp3'
    // The static server exposes '/usr/src/app/uploads' at the '/uploads' URL path.
    // So the final URL is 'https://your-domain.com/uploads/voice-notes/some-file.mp3'
    
    // We dynamically create the URL parts from the file object provided by Multer.
    // `req.file.destination` gives the full system path, which we don't want.
    // We need the part AFTER the base 'uploads' directory.
    const relativePath = req.file.path.split('uploads')[1].replace(/\\/g, '/'); // Get the path relative to the 'uploads' folder and normalize slashes.
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads${relativePath}`;
    
    // 3. Send a success response back to the frontend with the permanent URL.
    res.status(201).json({
        message: 'File uploaded successfully!',
        url: fileUrl,
        fileName: req.file.filename,
        sizeInBytes: req.file.size
    });
};