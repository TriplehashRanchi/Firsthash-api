const axios = require('axios');

const sendWhatsAppAccountActivated = async ({ name, company_name, phone }) => {
  try {
    const res = await axios.post(
      'https://backend.aisensy.com/campaign/t1/api/v2',
      {
        apiKey: process.env.AISENSY_API_KEY, // from .env
        campaignName: 'firsthash_welcome',
        destination: `91${phone}`,
        userName: name,
        source: 'FirstHash Payment',
        templateParams: [name, company_name],
        tags: ['firsthash_user'],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ WhatsApp sent via AiSensy:', res.data);
  } catch (err) {
    console.error('❌ WhatsApp send failed:', err?.response?.data || err.message);
  }
};


// const sendWhatsAppsAccountActivated = async ({ name, email, password, phone }) => {
//   try {
//     const res = await axios.post(
//       'https://backend.aisensy.com/campaign/t1/api/v2',
//       {
//         apiKey: process.env.AISENSY_API_KEY,
//         campaignName: 'firsthash_welcome',
//         destination: `91${phone}`,
//         userName: name,
//         source: 'FirstHash Payment',
//         // pass all four values as strings
//         templateParams: [name, email, password, phone],
//         tags: ['firsthash_user'],
//       },
//       {
//         headers: {
//           'Content-Type': 'application/json',
//         },
//       }
//     );

//     console.log('✅ WhatsApp sent via AiSensy:', res.data);
//   } catch (err) {
//     console.error(
//       '❌ WhatsApp send failed:',
//       err?.response?.data || err.message
//     );
//   }
// };



const sendWhatsAppsAccountActivated = async ({ name, company_name, phone }) => {
  try {
    const res = await axios.post(
      'https://backend.aisensy.com/campaign/t1/api/v2',
      {
        apiKey:        process.env.AISENSY_API_KEY,
        campaignName:  'firsthash_welcome',
        destination:   `91${phone}`,
        userName:      name,
        source:        'FirstHash Payment',
        templateParams:[ name, company_name ],
        tags:          ['firsthash_user'],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ WhatsApp sent via AiSensy:', res.data);
  } catch (err) {
    console.error(
      '❌ WhatsApp send failed:',
      err?.response?.data || err.message
    );
  }
};


const sendPaidWhatsAppConfirmation = async ({ phone, name, fileUrl }) => {
  try {
    const formattedPhone = `91${phone.replace(/\D/g, '').slice(-10)}`;
    const res = await axios.post(
      'https://backend.aisensy.com/campaign/t1/api/v2',
      {
        apiKey: process.env.AISENSY_API_KEY,
        campaignName: 'firsthash_bill_new',
        destination: formattedPhone,
        userName: name,
        source: 'FirstHash Payment',
        templateParams: [name, fileUrl], // Assuming your AiSensy template has 2 placeholders
        tags: ['payment_paid'],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('✅ WhatsApp sent via AiSensy:', res.data);
  } catch (err) {
    console.error('❌ WhatsApp send failed:', err?.response?.data || err.message);
  }
};

const sendTaskAssignmentWhatsApp = async ({ phone, assigneeName, projectName, taskName, dueDate, taskLink }) => {
  try {
    
    const formattedPhone = `91${phone.replace(/\D/g, '').slice(-10)}`;

    const res = await axios.post(
      "https://backend.aisensy.com/campaign/t1/api/v2",
      {
        apiKey: process.env.AISENSY_API_KEY,
        campaignName: "firsthash_new_shoot", 
        destination: formattedPhone,
        userName: assigneeName, 
        source: "FirstHash Task Management",
        templateParams: [
          assigneeName,  
          projectName,   
          taskName,      
          dueDate,       
          taskLink    
        ],
        tags: ["new_task_assigned"],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

     console.log(
      `✅ [AiSensy Success] Message sent to ${assigneeName} (${formattedPhone}) | Response:`,
      JSON.stringify(res.data)
    );
  } catch (err) {
    console.error(
      `❌ [AiSensy Failed] Could not send message to ${assigneeName} (${phone}):`,
      err?.response?.data || err.message
    );
  }
};

const sendShootAssignmentWhatsApp = async ({ phone, assigneeName, shootTitle, location, dateTime, shootLink }) => {
  try {
    const formattedPhone = `91${phone.replace(/\D/g, "").slice(-10)}`;

    const res = await axios.post(
      "https://backend.aisensy.com/campaign/t1/api/v2",
      {
        apiKey: process.env.AISENSY_API_KEY,
        campaignName: "firsthash_new_shoot",
        destination: formattedPhone,
        userName: assigneeName,
        source: "FirstHash Shoot Management",
        templateParams: [
          assigneeName, 
          shootTitle,   
          location,     
          dateTime,     
          shootLink  
        ],
        tags: ["shoot_assigned"],
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    console.log(`✅ WhatsApp sent to ${assigneeName} (${formattedPhone})`, res.data);
  } catch (err) {
    console.error(`❌ WhatsApp failed for ${assigneeName} (${phone}):`, err?.response?.data || err.message);
  }
};

module.exports = { 
  sendWhatsAppAccountActivated, 
  sendWhatsAppsAccountActivated, 
  sendPaidWhatsAppConfirmation, 
  sendTaskAssignmentWhatsApp,
  sendShootAssignmentWhatsApp
};
