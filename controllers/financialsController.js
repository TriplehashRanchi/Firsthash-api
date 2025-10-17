// controllers/financialsController.js
const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/db');
const projectModel = require('../models/projectModel');
const companyModel = require('../models/companyModel');
const financialsModel = require('../models/financialsModel');
const { sendPaidWhatsAppConfirmation } = require('../utils/sendAiSensyMessage');

exports.generateBill = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { projectId } = req.params;

    // ✅ Capture GST flag and number if passed from frontend
    const { amount, description, date_received, is_gst = false } = req.body;

    const paymentId = uuidv4();

    // Fetch project & company details
    const [projectData, companyData] = await Promise.all([
      projectModel.getProjectDetailsById(projectId, company_id),
      companyModel.getCompanyById(company_id),
    ]);

    if (!projectData || !companyData) {
      return res.status(404).json({ error: 'Project or company not found.' });
    }

    // --- Insert into received_payments with GST info ---
    const [result] = await db.query(
      `INSERT INTO received_payments (
         project_id, amount, is_gst, gst_number, description, created_at, type, status, file_url
       )
       VALUES (?, ?, ?, ?, ?, NOW(), 'received', 'pending', NULL)`,
      [
        projectId,
        amount,
        is_gst ? 1 : 0,
        companyData.gst_number || null,
        description || '',
      ]
    );

    const id = result.insertId;

    // Format transaction date
    const formattedDate = new Date(date_received).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const transactions = [
      {
        amount,
        date_received: formattedDate,
        description,
      },
    ];

    // --- Prepare template data ---
    const templateData = {
      project: projectData,
      company: {
        name: companyData.name,
        logo: companyData.logo,
        gst_number: companyData.gst_number || null,
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
        phone: projectData.clientPhone,
      },
      date: new Date().toLocaleDateString('en-GB'),
      amount,
      description,
      transactions,
      paymentId,
      isFullPaid: false,
      is_gst, // ✅ pass to EJS
    };

    // --- Render HTML from EJS template ---
    const templatePath = path.join(process.cwd(), 'templates', 'financials.ejs');
    const html = await ejs.renderFile(templatePath, templateData);

    // --- Setup upload directory ---
    const uploadsBasePath =
      process.env.NODE_ENV === 'production'
        ? '/usr/src/app/uploads'
        : path.join(process.cwd(), 'uploads');
    const uploadsDir = path.join(uploadsBasePath, 'financials');
    fs.mkdirSync(uploadsDir, { recursive: true });

    // --- Generate PDF ---
    const fileName = `financials-${projectId}-${uuidv4()}.pdf`;
    const filePath = path.join(uploadsDir, fileName);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0.2in', bottom: '0.2in', left: '0.3in', right: '0.3in' },
    });
    await browser.close();

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/financials/${fileName}`;

    // --- Update the record with PDF URL ---
    await db.query(`UPDATE received_payments SET file_url = ? WHERE id = ?`, [fileUrl, id]);

    // --- Send WhatsApp confirmation ---
    await sendPaidWhatsAppConfirmation({
      phone: projectData.clientPhone,
      name: projectData.clientName,
      fileUrl,
    });

    // --- Respond to client ---
    res.json({
      success: true,
      message: 'Bill generated successfully.',
      url: fileUrl,
    });
  } catch (err) {
    console.error('❌ Failed to generate financial PDF:', err);
    res.status(500).json({ error: 'Server error while generating bill.' });
  }
};



// New function for generating a bill with a "Full Paid" watermark
// exports.generateFullPaidBill = async (req, res) => {
//   try {
//     const company_id = req.user.company_id;
//     const { projectId } = req.params;
//     const { amount, description, date_received } = req.body;
//     const paymentId = uuidv4();
    
//     const [projectData, companyData] = await Promise.all([
//       projectModel.getProjectDetailsById(projectId, company_id),
//       companyModel.getCompanyById(company_id),
//     ]);

//     if (!projectData || !companyData) {
//       return res.status(404).json({ error: 'Project or company not found.' });
//     }

//     const [result] = await db.query(
//       `INSERT INTO received_payments (project_id, amount, description, created_at, type, file_url)
//        VALUES (?, ?, ?, NOW(), 'received', NULL)`,
//       [projectId, amount, description || '']
//     );

//     const id = result.insertId;

//     const formattedDate = new Date(date_received).toLocaleDateString('en-GB', {
//       day: '2-digit',
//       month: 'short',
//       year: 'numeric',
//     });

//     const transactions = [{
//       amount,
//       date_received: formattedDate,
//       description,
//     }];

//     const templateData = {
//       project: projectData,
//       company: {
//         name: companyData.name,
//         logo: companyData.logo,
//         address: `${companyData.address_line_1 || ''}\n${companyData.address_line_2 || ''}\n${companyData.city || ''}, ${companyData.state || ''} - ${companyData.pincode || ''}`.trim(),
//         email: `Mail: ${req.user.email}`,
//         phone: `Tel: ${req.user.phone || 'N/A'}`,
//         bank_name: companyData.bank_name,
//         bank_account_number: companyData.bank_account_number,
//         bank_ifsc_code: companyData.bank_ifsc_code,
//         upi_id: companyData.upi_id,
//         payment_qr_code_url: companyData.payment_qr_code_url,
//       },
//       customer: {
//         name: projectData.clientName,
//         email: projectData.clientEmail,
//         phone: projectData.clientPhone,
//       },
//       date: new Date().toLocaleDateString('en-GB'),
//       amount,
//       description,
//       transactions,
//       paymentId,
//       isFullPaid: true // This will be used in the EJS template
//     };

//     const templatePath = path.join(process.cwd(), 'templates', 'financials.ejs');
//     const html = await ejs.renderFile(templatePath, templateData);

//     const uploadsDir = path.join(process.cwd(), 'uploads', 'financials');
//     fs.mkdirSync(uploadsDir, { recursive: true });

//     const fileName = `financials-fullpaid-${projectId}-${uuidv4()}.pdf`;
//     const filePath = path.join(uploadsDir, fileName);

//     const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
//     const page = await browser.newPage();
//     await page.setContent(html, { waitUntil: 'networkidle0' });

//     await page.pdf({
//       path: filePath,
//       format: 'A4',
//       printBackground: true,
//       margin: { top: '0.2in', bottom: '0.2in', left: '0.3in', right: '0.3in' }
//     });

//     await browser.close();

//     const fileUrl = `${req.protocol}://${req.get('host')}/uploads/financials/${fileName}`;

//     await db.query(
//       `UPDATE received_payments SET file_url = ? WHERE id = ?`,
//       [fileUrl, id]
//     );

//     res.json({
//       success: true,
//       message: `Full paid bill generated successfully.`,
//       url: fileUrl
//     });

//   } catch (err) {
//     console.error('❌ Failed to generate full paid financial PDF:', err);
//     res.status(500).json({ error: 'Server error while generating bill.' });
//   }
// };

// controllers/financialsController.js

exports.markPaymentAsPaid = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { paymentId } = req.params;

    // --- This is the new "Paid On" date ---
    const paidOnDate = new Date();

    // 1. Fetch the existing payment record
    const [paymentRows] = await db.query(`SELECT * FROM received_payments WHERE id = ?`, [paymentId]);

    if (paymentRows.length === 0) {
      return res.status(404).json({ error: 'Payment not found.' });
    }
    const paymentData = paymentRows[0];
    const projectId = paymentData.project_id;

    // 2. Fetch associated project and company data for the PDF
    const [projectData, companyData] = await Promise.all([
      projectModel.getProjectDetailsById(projectId, company_id),
      companyModel.getCompanyById(company_id),
    ]);

    if (!projectData || !companyData) {
      return res.status(404).json({ error: 'Project or company not found for this payment.' });
    }

    // 3. Prepare data for the PDF template
    const templateData = {
      project: projectData,
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
        gst_number: companyData.gst_number || null, // ✅ added
      },
      customer: {
        name: projectData.clientName,
        email: projectData.clientEmail,
        phone: projectData.clientPhone,
      },
      date: new Date().toLocaleDateString('en-GB'),
      amount: paymentData.amount,
      description: paymentData.description,
      paymentId: paymentId.toString(),
      isFullPaid: true, // This enables the "PAID" stamp in the PDF
      
      // --- We now pass the specific "Paid On" date to the template ---
      is_gst: paymentData.is_gst || false, // ✅ added this line
      paid_on_date: paidOnDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    };

    // 4. Generate the new PDF
    const templatePath = path.join(process.cwd(), 'templates', 'financials.ejs');
    const html = await ejs.renderFile(templatePath, templateData);
    const uploadsBasePath = process.env.NODE_ENV === 'production' 
        ? '/usr/src/app/uploads' 
        : path.join(process.cwd(), 'uploads');
    const uploadsDir = path.join(uploadsBasePath, 'financials');
    fs.mkdirSync(uploadsDir, { recursive: true });

    const fileName = `financials-paid-${projectId}-${uuidv4()}.pdf`;
    const filePath = path.join(uploadsDir, fileName);

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: filePath, format: 'A4', printBackground: true });
    await browser.close();

    const newFileUrl = `${req.protocol}://${req.get('host')}/uploads/financials/${fileName}`;

    // --- KEY CHANGE: Update `date_received` column with the new paid date ---
    await db.query(
      `UPDATE received_payments SET file_url = ?, status = 'paid', date_received = ? WHERE id = ?`,
      [newFileUrl, paidOnDate, paymentId]
    );

    sendPaidWhatsAppConfirmation({
      phone: projectData.clientPhone,
      name: projectData.clientName,
      fileUrl: newFileUrl
    })
    // 6. Respond with the fully updated payment record
    const [finalRows] = await db.query(`SELECT * FROM received_payments WHERE id = ?`, [paymentId]);
    res.json({
      success: true,
      message: `Bill marked as paid successfully.`,
      updatedPayment: finalRows[0],
    });

  } catch (err) {
    console.error('❌ Failed to mark payment as paid:', err);
    res.status(500).json({ error: 'Server error while processing payment.' });
  }
};