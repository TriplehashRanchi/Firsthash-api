// File: controllers/quotationController.js

const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Import all necessary models
const projectModel = require('../models/projectModel');
const companyModel = require('../models/companyModel');
const quotationModel = require('../models/quotationModel');

/**
 * Generates a premium, multi-table PDF quotation using Puppeteer and an EJS template.
 */
exports.generateQuotation = async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const { projectId } = req.params;

        // 1. Fetch All Necessary Data using the models
        // We run these in parallel for better performance
        const [projectData, companyData] = await Promise.all([
            projectModel.getProjectDetailsById(projectId, company_id),
            companyModel.getCompanyById(company_id)
        ]);

        if (!projectData || !companyData) {
            return res.status(404).json({ error: 'Project or company data not found.' });
        }

        // 2. Prepare the Data Object for the EJS Template
// 2. Prepare Data for the EJS Template
        const templateData = {
            project: projectData, // Pass the whole project object
            company: {
                name: companyData.name,
                logo: companyData.logo,
                address: `${companyData.address_line_1 || ''}\n${companyData.address_line_2 || ''}\n${companyData.city || ''}, ${companyData.state || ''} - ${companyData.pincode || ''}`.trim(),
                email: `Mail: ${req.user.email}`,
                phone: `Tel: ${req.user.phone || 'N/A'}`,
                bank_name: companyData.bank_name,
                bank_account_number: companyData.bank_account_number,
                bank_ifsc_code: companyData.bank_ifsc_code,
                upi_id: companyData.upi_id,
                payment_qr_code_url: companyData.payment_qr_code_url,
            },
            customer: {
                name: projectData.clientName,
                email: projectData.clientEmail,
                phone: projectData.clientPhone
            },
            invoice: {
                number: `QT-${Date.now()}`,
                date: new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }),
            },
            shoots: projectData.shoots.shootList,
            deliverables: projectData.deliverables.deliverableItems
        };

        // 3. Render HTML (no change)
        const templatePath = path.join(process.cwd(), 'templates', 'quotation.ejs');
        const html = await ejs.renderFile(templatePath, templateData);

        // 4. Configure file paths for saving the PDF
        const uploadsBasePath = process.env.NODE_ENV === 'production' 
            ? '/usr/src/app/uploads' 
            : path.join(process.cwd(), 'uploads');
        
        const quoteDirectory = path.join(uploadsBasePath, 'quotations');
        // Ensure the directory exists before trying to write to it
        fs.mkdirSync(quoteDirectory, { recursive: true });

        const quoteFileName = `quotation-${projectId}-${uuidv4()}.pdf`;
        const quoteFilePath = path.join(quoteDirectory, quoteFileName);

        // 5. Use Puppeteer to "Print" the HTML to a PDF
        const browser = await puppeteer.launch({ 
            headless: true, // Use 'new' in future Puppeteer versions
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Important for running in Docker/Linux
        });
        const page = await browser.newPage();
        
        // Tell Puppeteer to load our rendered HTML
        await page.setContent(html, { waitUntil: 'networkidle0' }); // Waits for network calls like images/Tailwind to finish
        
        // Generate the PDF from the page content
        await page.pdf({
            path: quoteFilePath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0.1in',
                right: '0.1in',
                bottom: '0.1in',
                left: '0.1in'
            }
        });

        await browser.close();

        // 6. Save a reference of the generated quotation to our database
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/quotations/${quoteFileName}`;
        const { version } = await quotationModel.saveQuotationRecord(projectId, fileUrl);

        // 7. Send the final URL back to the frontend
        res.json({
            success: true,
            message: `Quotation Version ${version} generated successfully!`,
            url: fileUrl,
            version: version
        });

    } catch (err) {
        console.error('❌ Failed to generate quotation:', err);
        res.status(500).json({ error: 'Server error while generating quotation.' });
    }
};