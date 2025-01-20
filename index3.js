const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

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

    // Send the text to GPT API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
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

app.post("/api/create-ticket", async (req, res) => {
    const ticketData = req.body;

    try {
        // Step 1: Fetch the access token
        const accessToken = await fetchAccessToken();

        // Step 2: Use the access token to create a ticket
        const response = await axios.post(
            "https://desk.zoho.com/api/v1/tickets",
            ticketData,
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Zoho-oauthtoken ${accessToken}`,
                },
            }
        );

        // Send the response back to the client
        res.status(200).json(response.data);
    } catch (error) {
        console.error("Error creating ticket:", error.message);

        if (error.response) {
            // Handle specific Zoho API errors
            res.status(error.response.status).json({
                error: error.response.data || "Failed to create ticket",
            });
        } else if (error.request) {
            // Handle no response received from Zoho API
            res.status(500).json({
                error: "No response from Zoho API. Please try again later.",
            });
        } else {
            // Handle other unknown errors
            res.status(500).json({ error: "An unknown error occurred." });
        }
    }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
