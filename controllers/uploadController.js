exports.handleUpload = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file was provided in the request.' });
    }
    const relativePath = req.file.path.split('uploads')[1].replace(/\\/g, '/'); 
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads${relativePath}`;
    
    // 3. Send a success response back to the frontend with the permanent URL.
    res.status(201).json({
        message: 'File uploaded successfully!',
        url: fileUrl,
        fileName: req.file.filename,
        sizeInBytes: req.file.size
    });
};