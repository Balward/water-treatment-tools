# Claude AI Proxy Server Setup

This proxy server enables Claude AI integration with the water treatment data analyzer by handling API calls server-side to avoid CORS issues.

## Prerequisites

1. **Node.js** - Download and install from https://nodejs.org/
2. **Claude API Key** - Get from https://console.anthropic.com/

## Setup Instructions

### 1. Install Dependencies

Open Command Prompt or PowerShell in the project directory and run:

```bash
cd "C:\Users\Blain\OneDrive\Documents\water-treatment-tools"
npm install
```

### 2. Configure API Key

The API key is already configured in `claude-proxy-server.js`. If you need to change it, edit line 8:

```javascript
const CLAUDE_API_KEY = "your-api-key-here";
```

### 3. Start the Proxy Server

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

You should see:
```
Claude proxy server running on http://localhost:3001
Health check: http://localhost:3001/health
API endpoint: http://localhost:3001/api/claude
```

### 4. Test the Proxy Server

Visit http://localhost:3001/health in your browser. You should see:
```json
{"status":"OK","service":"Claude Proxy Server"}
```

### 5. Use with Data Analyzer

1. Keep the proxy server running (don't close the Command Prompt window)
2. Open the data analyzer in your browser (via Live Server)
3. Go to the Optimization tab and create a correlation scatter plot
4. Click "💡 Explain Correlation" - it should now use Claude AI!

## Architecture

```
Browser App → Proxy Server (localhost:3001) → Claude API (api.anthropic.com)
```

The proxy server:
- Receives correlation data from the browser app
- Formats the request for Claude API
- Forwards the API response back to the browser
- Handles CORS and authentication

## Troubleshooting

### "Proxy server not running" error
- Make sure you ran `npm start` and the server is running
- Check that you see "Claude proxy server running" in the console

### "Claude API authentication failed" error
- Check your API key in `claude-proxy-server.js`
- Verify your Anthropic account has credits/billing set up

### Port 3001 already in use
- Change the PORT variable in `claude-proxy-server.js` to a different number (e.g., 3002)
- Update CLAUDE_PROXY_URL in the data analyzer script accordingly

### Dependencies not found
- Run `npm install` again
- Make sure you're in the correct directory

## Security Notes

- The API key is stored in the server file - keep this secure
- The proxy server runs locally only (localhost)
- For production, move API key to environment variables

## Development

To modify the proxy server:
1. Edit `claude-proxy-server.js`
2. Restart the server (Ctrl+C, then `npm start`)
3. Test changes in the browser app