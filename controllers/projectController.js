const {
  findOrCreateClient,
  createProject,
  insertShoots,
  insertDeliverables,
  insertReceivedAmount,
  insertPaymentSchedule,
  getAllProjectsWithDetails,
  getProjectDetailsById,
  updateStatusById,
  fetchAllRoles,
  fetchDataForAllocationCalendar,
} = require('../models/projectModel');
const {addPayment} = require('../models/paymentModel');

exports.createFullProject = async (req, res) => {
  try {
    const company_id  = req.company.id; // Assuming company_id comes from token
    const {
      projectName,
      projectPackageCost,
      deliverablesAdditionalCost,
      overallTotalCost,
      clients,
      projectDetails,
      shoots,
      deliverables,
      receivedAmount,
      // paymentSchedule,
    } = req.body;

    // console.log('Deliverables:', deliverables);

    if (!projectName || !clients) {
      return res.status(400).json({ error: 'Missing project name or client details.' });
    }

    // 1. Create/find client
    const client_id = await findOrCreateClient(company_id, clients.clientDetails);

    // 2. Save project
    const project_id = await createProject(
      company_id,
      projectName,
      {
        packageCost: projectPackageCost,
        deliverablesCost: deliverablesAdditionalCost,
        totalCost: overallTotalCost,
      },
      client_id
    );

    // 3. Save sub-sections
    await insertShoots(project_id, shoots, company_id);
    await insertDeliverables(project_id, deliverables?.deliverableItems || []);
    await insertReceivedAmount(project_id, receivedAmount?.transaction);
    // await insertPaymentSchedule(project_id, paymentSchedule?.paymentInstallments || []);
  
    

    res.json({ success: true, project_id });
  } catch (err) {
    console.error('❌ Failed to save project:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


// --- NEW: Controller Function for the Project List Page ---
// This is the new function you need to add.
exports.getProjectsList = async (req, res) => {
  try {

    console.log("IN GET PROJECTS LIST, REQ.USER:", req.user); // Check what the middleware provides
    console.log("IN GET PROJECTS LIST, REQ.COMPANY:", req.company); 
    // 1. Get the company_id from your authentication middleware
    const company_id = req.company.id; 

    // 2. Get the optional 'status' filter from the query string (e.g., ?status=ongoing)
    const { status } = req.query;

    // 3. Call the model function to get all the aggregated project data
    const projects = await getAllProjectsWithDetails(company_id, status);
    
    // 4. Send the data back to the frontend
    res.json(projects);

  } catch (err) {
    console.error('❌ Failed to fetch projects list:', err);
    res.status(500).json({ error: 'Server error while fetching projects.' });
  }
};


exports.getProjectById = async (req, res) => {
  try {
    // 1. Get the project's UUID from the URL parameters (e.g., /api/projects/some-uuid-string)
    const projectUuid = req.params.id;

    // 2. Get the company ID from the authenticated user's token (from the 'protect' middleware)
    const company_id = req.company.id;

    // 3. Call our powerful model function with the required IDs
    const projectData = await getProjectDetailsById(projectUuid, company_id);

    // 4. Handle the response
    if (projectData) {
      // If data was found, send it back with a 200 OK status
      res.json(projectData);
    } else {
      // If the model returned null, it means the project wasn't found or doesn't belong
      // to this company. Send a 404 Not Found status.
      res.status(404).json({ error: 'Project not found or you do not have permission to view it.' });
    }
  } catch (err) {
    // If any other error occurs (e.g., database connection issue), log it for debugging
    // and send a generic 500 Server Error status.
    console.error('❌ Failed to fetch project details:', err);
    res.status(500).json({ error: 'An error occurred while fetching project details.' });
  }
};

exports.addReceivedPayment = async (req, res) => {
    try {
        // The controller's job is to handle the request and validate data
        const { projectId } = req.params;
        const { amount, date, description } = req.body;

        if (!amount || !date) {
            return res.status(400).json({ error: 'Amount and date are required.' });
        }
        
        // The controller passes the data to the model. It doesn't know how the database works.
        const newPayment = await addPayment({ projectId, amount, date, description });
        
        // Send the successful response
        res.status(201).json(newPayment);

    } catch (err) {
        console.error('❌ Failed to add payment:', err);
        res.status(500).json({ error: 'Server error while adding payment.' });
    }
};

exports.updateProjectStatus = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { status: newStatus } = req.body;

    // --- Input Validation ---
    const allowedStatuses = ['ongoing', 'completed', 'rejected'];
    if (!newStatus || !allowedStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid or missing status provided. Must be one of: ongoing, completed, rejected.' });
    }

    // Call the model to perform the database update
    const result = await updateStatusById(projectId, newStatus);

    // Check if any row was actually updated
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Project not found or status is already set.' });
    }

    res.json({ success: true, message: `Project status successfully updated to ${newStatus}.` });

  } catch (err) {
    console.error('❌ Failed to update project status:', err);
    res.status(500).json({ error: 'Server error while updating project status.' });
  }
};


exports.getAllocationsData = async (req, res) => {
    try {
        const company_id = req.company.id;
        const allocationData = await fetchDataForAllocationCalendar(company_id);
        res.json(allocationData);
    } catch (err) {
        console.error('❌ Failed to fetch allocation data:', err);
        res.status(500).json({ error: 'Server error while fetching allocation data.' });
    }
};