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
            content: `Extract the following details from the provided text and return them in a key-value format without any additional signs, symbols, or newline characters. Ensure that the extracted department and team match the predefined valid list below and return their respective IDs instead of names.

                      ### **Valid Departments and Their Corresponding Team IDs:**

                      Planning Department -> 481842000003244029
                        - Planning Team -> 481842000003280197

                      Production Department -> 481842000003250467
                        - Production Team 1 -> 481842000003280141
                        - Production Team 2 -> 481842000003280155
                        - Production Team 3 -> 481842000003280169

                      Service Department -> 481842000003257905
                        - Service Team -> 481842000003280183

                      Engineering Department -> 481842000003265343
                        - ALUSS -> 481842000003280001
                        - Composite -> 481842000003280015
                        - Interior Engineering -> 481842000003280029
                        - Yacht Design -> 481842000003280043
                        - Interior Design -> 481842000003280057
                        - Yacht Design 3D Visuals -> 481842000003280071
                        - Deck Outfitting -> 481842000003280085
                        - Electrical -> 481842000003280099
                        - Integrated Solutions -> 481842000003280113
                        - Machinery and Piping -> 481842000003280127

                      Ensure that the selected **team corresponds to the department**. If a mismatch is found, correct it based on the best available match.

                      ### **Extract the following details:**
                      1. Project_name
                      2. Project_id
                      3. Department (Return the ID of the matched department)
                      4. Team_name (Return the ID of the matched team)
                      5. Description
                      6. Severity
                      7. Subject (A concise summary of the issue, generated dynamically)

                      ### **Example Input:**
                      "This is for project SY-127 Software Development, department is Engineering, team is Interior Engineering. The task is to create a different design blueprint for our new yacht launch. The priority is high, and it needs to be completed by next Friday."

                      ### **Example Output:**
                      {
                        "Project_name": "Software Development",
                        "Project_id": "SY-127",
                        "Department": "481842000003265343",
                        "Team_name": "481842000003280029",
                        "Description": "The task is to create a different design blueprint for our new yacht launch. The priority is high, and it needs to be completed by next Friday.",
                        "Severity": "High",
                        "Subject": "Blueprint design required for new yacht launch."
                      }

                      Input: ${text}
`
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
      const { subject, departmentId, description, severity, additionalNotes, contactId,ticketCreator, team,projectName} = req.body;


      // Step 1: Create ticket in Zoho Desk
      const accessToken = await fetchAccessToken(); // Replace with your token
      if(!accessToken){
        return res.status(500).json({
          "message" : "access token not found"
        })
      }

      console.log("generated token : ", accessToken);

        // ✅ Correcting the ticketData format
        const ticketData = {
          subject: subject,
          departmentId: departmentId, // Zoho department ID (keep this same)
          description: `${description}`, // Merging description & notes
          language: "English",
          priority: severity, // Maps severity to priority
          status: "Open", // Setting initial status
          category: "general", // Adjust category if needed
          contactId: "481842000003206001", // Set correct contact ID
          productId: "", // Can be updated if needed
          cf: { // ✅ Add custom fields (cf)
              cf_permanentaddress: null,
              cf_dateofpurchase: null,
              cf_phone: null,
              cf_numberofitems: null,
              cf_url: null,
              cf_secondaryemail: null,
              cf_severitypercentage: "0.0",
              cf_modelname: "F3 2017",
              cf_ticket_creator : ticketCreator,
              cf_team_assigned : team,
              cf_project_name : projectName
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

        // ✅ Step 1: Log access token before uploading
        console.log("🔑 Using Access Token for Upload:", accessToken);

        // ✅ Step 2: Ensure orgId is present
        console.log("📌 Using orgId:", ZOHO_ORG_ID);
        if (!ZOHO_ORG_ID) {
            throw new Error("❌ orgId is missing. Please check your .env file.");
        }

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


module.exports = app;

// app.listen(PORT, () => {  
//   console.log(`Server is running on port ${PORT}`);
// });
