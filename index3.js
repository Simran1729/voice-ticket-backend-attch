const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
require('dotenv').config({ path: __dirname + '/.env' });
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());


const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REDIRECT_URI = process.env.ZOHO_REDIRECT_URI;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_TOKEN_URL = process.env.ZOHO_TOKEN_URL;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

console.log("🔍 Loaded Environment Variables:");
console.log("-------------------------------------------------");
console.log("✅ PORT: ", process.env.PORT || "⚠️ Not Set (Using Default 3000)");
console.log("✅ OPENAI_API_KEY: ", process.env.OPENAI_API_KEY ? "✅ Loaded" : "❌ NOT LOADED");
console.log("✅ ZOHO_CLIENT_ID: ", process.env.ZOHO_CLIENT_ID || "❌ NOT LOADED");
console.log("✅ ZOHO_CLIENT_SECRET: ", process.env.ZOHO_CLIENT_SECRET || "❌ NOT LOADED");
console.log("✅ ZOHO_REDIRECT_URI: ", process.env.ZOHO_REDIRECT_URI || "❌ NOT LOADED");
console.log("✅ ZOHO_REFRESH_TOKEN: ", process.env.ZOHO_REFRESH_TOKEN || "❌ NOT LOADED");
console.log("✅ ZOHO_TOKEN_URL: ", process.env.ZOHO_TOKEN_URL || "❌ NOT LOADED");
console.log("✅ ZOHO_ORG_ID: ", process.env.ZOHO_ORG_ID || "❌ NOT LOADED");
console.log("-------------------------------------------------");

// Route 1: Check if the server is running
app.get('/', (req, res) => {
  console.log('Ping route accessed.');
  res.send('Server is running!');
});

// Route 2: Process JSON data and send to GPT API
app.post('/process-text', async (req, res) => {
  try {
    console.log('Received request on /process-text');
    console.log('Request body:', req.body);

    const text = req.body.text;
    if (!text) {
      console.error('No text provided in the request body.');
      return res.status(400).json({ error: 'Text field is required.' });
    }

    console.log('Text received from frontend:', text);
    console.log("using this key -----------> ", OPENAI_API_KEY);

    // Send the text to GPT API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', 
            content: `Extract the following details from the provided text and return them in a key value format and don't have any additional signs or next line characters.Make sure that the names of keys are the following only:
                      1. Project_name
                      2. Department
                      3. Description
                      4. Severity
                      5. Due_Date (if mentioned)
                      6. Additional_Notes (if any)

                      Example Input:
                      "This is for project HCL Tech, department marketing. The task is to create a social media campaign plan for our new yacht launch. The priority is high, and it needs to be completed by next Friday. Additional note: coordinate with the graphic design team for visuals."

                      Example Output:
                      {
                        "Project_name": "HCL Tech",
                        "Department": "Marketing",
                        "Description": "Create a social media campaign plan for our new yacht launch.",
                        "Severity": "High",
                        "Due_Date": "Next Friday",
                        "Additional_Notes": "Coordinate with the graphic design team for visuals."
                      }

                      Input: ${text}`
           }],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Response from GPT API:', response.data);
    console.log('new console: ', response.data.choices[0].message.content)


    // Send GPT response back to the client
    res.json(response.data.choices[0].message.content);
  } catch (error) {
    console.error('Error processing request:', error.message);
    console.error('this is the errror : ', error);
    res.status(500).json({ error: 'An error occurred while processing the request.' });
  }
});


async function fetchAccessToken() {
  try {
        const url = `${ZOHO_TOKEN_URL}?grant_type=refresh_token&client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&redirect_uri=${ZOHO_REDIRECT_URI}&refresh_token=${ZOHO_REFRESH_TOKEN}`;
        const response = await axios.post(url);

      if (response.data && response.data.access_token) {
          console.log("access token generated: ", response.data.access_token )
          return response.data.access_token;
      } else {
          throw new Error("Access token not found in the response.");
      }
  } catch (error) {
      console.error("Error fetching access token:", error.message);
      throw error;
  }
}

const upload = multer({storage : multer.memoryStorage()});

app.post("/api/create-ticket", upload.array('files', 10), async (req, res) => {
  try {
      // Extract form data
      const { subject, departmentId, description, severity, additionalNotes, contactId } = req.body;


      // Step 1: Create ticket in Zoho Desk
      const accessToken = await fetchAccessToken(); // Replace with your token
      if(!accessToken){
        return res.status(500).json({
          "message" : "access token not found"
        })
      }

        // ✅ Correcting the ticketData format
        const ticketData = {
          subject: subject,
          departmentId: "722569000000006907", // Zoho department ID (keep this same)
          description: `${description}\n\nAdditional Notes: ${additionalNotes}`, // Merging description & notes
          language: "English",
          priority: severity, // Maps severity to priority
          status: "Open", // Setting initial status
          category: "general", // Adjust category if needed
          contactId: "722569000000722001", // Set correct contact ID
          productId: "", // Can be updated if needed
          cf: { // ✅ Add custom fields (cf)
              cf_permanentaddress: null,
              cf_dateofpurchase: null,
              cf_phone: null,
              cf_numberofitems: null,
              cf_url: null,
              cf_secondaryemail: null,
              cf_severitypercentage: "0.0",
              cf_modelname: "F3 2017"
          },
      };

      console.log("ticketData is : ", ticketData);

      const ticketResponse = await axios.post(
          "https://desk.zoho.com/api/v1/tickets",
          ticketData,
          {
              headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Zoho-oauthtoken ${accessToken}`,
              },
          }
      );

      console.log("ticket created");
      const ticketId = ticketResponse.data.id; // <-- Correct way to get the ticket ID
      const ticketNumber = ticketResponse.data.ticketNumber; // <-- This is the readable ticket number

      console.log("✅ Ticket Created Successfully:");
      console.log("Ticket ID:", ticketId);
      console.log("Ticket Number:", ticketNumber);


      // // Step 2: Upload attachments directly from memory
      // if (req.files && req.files.length > 0) {
      //     for (const file of req.files) {
      //         const formData = new FormData();
      //         formData.append("file", file.buffer, { filename: file.originalname });

      //         const accessToken1 = await fetchAccessToken();

      //         await axios.post(
      //             `https://desk.zoho.com/api/v1/tickets/${ticketId}/attachments`,
      //             formData,
      //             {
      //                 headers: {
      //                     "Authorization": `Zoho-oauthtoken ${accessToken1}`,
      //                     orgId: ZOHO_ORG_ID,
      //                     ...formData.getHeaders(),
      //                 },
      //             }
      //         );

      //         console.log(`Uploaded: ${file.originalname}`);
      //     }
      // }

        // ✅ Step 1: Log access token before uploading
        console.log("🔑 Using Access Token for Upload:", accessToken);

        // ✅ Step 2: Ensure orgId is present
        console.log("📌 Using orgId:", ZOHO_ORG_ID);
        if (!ZOHO_ORG_ID) {
            throw new Error("❌ orgId is missing. Please check your .env file.");
        }

        // ✅ Step 3: Upload files correctly
        // if (req.files && req.files.length > 0) {
        //     for (const file of req.files) {
        //         const formData = new FormData();
        //         formData.append("file", file.buffer, file.originalname); // ✅ Correct FormData format

        //         await axios.post(
        //             `https://desk.zoho.com/api/v1/tickets/${ticketId}/attachments`,
        //             formData,
        //             {
        //                 headers: {
        //                     "Authorization": `Zoho-oauthtoken ${accessToken}`, // ✅ Use same token
        //                     "orgId": ZOHO_ORG_ID, 
        //                     ...formData.getHeaders(),
        //                 },
        //             }
        //         );

        //         console.log(`✅ Uploaded: ${file.originalname}`);
        //     }
        // }

      if (!req.files || req.files.length === 0) {
          console.log("⚠️ No files uploaded.");
      } else {
          for (const file of req.files) {
              console.log(`📁 Uploading File: ${file.originalname}`);
      
              const formData = new FormData();
              formData.append("file", file.buffer, { filename: file.originalname });
      
              await axios.post(
                  `https://desk.zoho.com/api/v1/tickets/${ticketId}/attachments`,
                  formData,
                  {
                      headers: {
                        'Content-Type': 'multipart/form-data',
                          "Authorization": `Zoho-oauthtoken ${accessToken}`,
                          "orgId": ZOHO_ORG_ID,
                          ...formData.getHeaders(),
                      },
                  }
              );
      
              console.log(`✅ Uploaded: ${file.originalname}`);
          }
      }
      

      res.status(200).json({ message: "Ticket created successfully!", ticketId });

  } catch (error) {
      console.error("Error:", error.message);
      res.status(500).json({ error: "An error occurred", details: error.message });
  }
});


app.listen(PORT, () => {  
  console.log(`Server is running on port ${PORT}`);
});
