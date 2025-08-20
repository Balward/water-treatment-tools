require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

// Your Claude API key from environment variable
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || "YOUR_CLAUDE_API_KEY_HERE";

// Debug: Check if API key is loaded (without logging the full key)
console.log('API Key loaded:', CLAUDE_API_KEY ? `${CLAUDE_API_KEY.substring(0, 15)}...` : 'NOT FOUND');

// Middleware
app.use(cors());
app.use(express.json());

// Proxy endpoint for Claude API
app.post('/api/claude', async (req, res) => {
  try {
    console.log('Received request for Claude explanation');
    
    const { targetVariable, predictorVariable, correlationValue } = req.body;
    
    if (!targetVariable || !predictorVariable || correlationValue === undefined) {
      return res.status(400).json({ 
        error: 'Missing required parameters: targetVariable, predictorVariable, correlationValue' 
      });
    }

    const prompt = `Explain the correlation coefficient of ${correlationValue.toFixed(3)} between "${targetVariable}" and "${predictorVariable}" in a water treatment facility context.

Focus on the technical relationships and mechanisms that could cause this correlation:
- Physical and chemical processes in water treatment
- Seasonal effects and operational factors  
- Equipment interactions and process dependencies
- Water quality relationships

Provide a direct technical explanation of the underlying mechanisms without introductory phrases. Keep it concise but informative (2-3 paragraphs).`;

    console.log('Making Claude API request...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API Error:', errorText);
      return res.status(response.status).json({ 
        error: `Claude API failed: ${response.status}`,
        details: errorText 
      });
    }

    const data = await response.json();
    console.log('Claude API response received');

    if (data.content && data.content[0] && data.content[0].text) {
      const explanation = data.content[0].text.trim();
      res.json({ 
        explanation: explanation,
        success: true 
      });
    } else {
      console.error('Invalid Claude API response structure:', data);
      res.status(500).json({ 
        error: 'Invalid Claude API response structure' 
      });
    }

  } catch (error) {
    console.error('Proxy server error:', error);
    res.status(500).json({ 
      error: 'Proxy server error',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Claude Proxy Server' });
});

app.listen(PORT, () => {
  console.log(`Claude proxy server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('API endpoint: http://localhost:${PORT}/api/claude');
});