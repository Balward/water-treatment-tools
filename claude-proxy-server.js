require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

// API keys from environment variables
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || "YOUR_CLAUDE_API_KEY_HERE";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "YOUR_OPENAI_API_KEY_HERE";

// Debug: Check if API keys are loaded (without logging the full keys)
console.log('Claude API Key loaded:', CLAUDE_API_KEY ? `${CLAUDE_API_KEY.substring(0, 15)}...` : 'NOT FOUND');
console.log('OpenAI API Key loaded:', OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 15)}...` : 'NOT FOUND');

// Middleware
app.use(cors());
app.use(express.json());

// Proxy endpoint for AI explanations (Claude or OpenAI)
app.post('/api/claude', async (req, res) => {
  try {
    console.log('Received request for AI explanation');
    
    const { targetVariable, predictorVariable, correlationValue, provider = 'claude' } = req.body;
    
    if (!targetVariable || !predictorVariable || correlationValue === undefined) {
      return res.status(400).json({ 
        error: 'Missing required parameters: targetVariable, predictorVariable, correlationValue' 
      });
    }

    // Validate provider and API key
    if (provider === 'claude' && (!CLAUDE_API_KEY || CLAUDE_API_KEY === "YOUR_CLAUDE_API_KEY_HERE")) {
      return res.status(400).json({ error: 'Claude API key not configured' });
    }
    if (provider === 'openai' && (!OPENAI_API_KEY || OPENAI_API_KEY === "YOUR_OPENAI_API_KEY_HERE")) {
      return res.status(400).json({ error: 'OpenAI API key not configured' });
    }

    const prompt = `Explain the correlation coefficient of ${correlationValue.toFixed(3)} between "${targetVariable}" and "${predictorVariable}" in a water treatment facility context.

Focus on the technical relationships and mechanisms that could cause this correlation:
- Physical and chemical processes in water treatment
- Seasonal effects and operational factors  
- Equipment interactions and process dependencies
- Water quality relationships

Provide a direct technical explanation of the underlying mechanisms without introductory phrases. Keep it concise but informative (2-3 paragraphs).`;

    console.log(`Making ${provider.toUpperCase()} API request...`);

    let response;
    
    if (provider === 'claude') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
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
    } else if (provider === 'openai') {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          max_tokens: 400,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });
    } else {
      return res.status(400).json({ error: 'Invalid provider. Must be "claude" or "openai"' });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${provider.toUpperCase()} API Error:`, errorText);
      return res.status(response.status).json({ 
        error: `${provider.toUpperCase()} API failed: ${response.status}`,
        details: errorText 
      });
    }

    const data = await response.json();
    console.log(`${provider.toUpperCase()} API response received`);

    let explanation;
    
    if (provider === 'claude') {
      if (data.content && data.content[0] && data.content[0].text) {
        explanation = data.content[0].text.trim();
      } else {
        console.error('Invalid Claude API response structure:', data);
        return res.status(500).json({ error: 'Invalid Claude API response structure' });
      }
    } else if (provider === 'openai') {
      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        explanation = data.choices[0].message.content.trim();
      } else {
        console.error('Invalid OpenAI API response structure:', data);
        return res.status(500).json({ error: 'Invalid OpenAI API response structure' });
      }
    }

    if (explanation) {
      res.json({ 
        explanation: explanation,
        provider: provider,
        success: true 
      });
    } else {
      res.status(500).json({ 
        error: `Failed to parse ${provider.toUpperCase()} response` 
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