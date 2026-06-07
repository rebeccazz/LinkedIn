# Local Development Setup

## Quick Start

### 1. Install dependencies
```bash
npm install express
```

Or if you want to use the existing package.json, just run:
```bash
npm install
```

### 2. Set your Claude API key
```bash
export Claude=sk-ant-xxxxxxxxxxxxx
```

(Replace with your actual API key from https://console.anthropic.com)

### 3. Run the local server
```bash
node local-server.js
```

You should see:
```
✅ Local server running on http://localhost:3000
📝 Make sure Claude API key is set: export Claude=YOUR_KEY
🔗 Endpoints:
   POST http://localhost:3000/api/groq
   POST http://localhost:3000/api/personalize
```

### 4. Switch the extension to use local API

Edit `popup.js` and change this line:
```javascript
const API_BASE_URL = "http://localhost:3000";  // ← LOCAL (for testing)
```

From:
```javascript
const API_BASE_URL = "https://linked-in-nu-virid.vercel.app";  // Production
```

### 5. Reload the extension
- Right-click the extension popup
- Click "Reload"
- Or press Ctrl+Shift+R

### 6. Test
- Open a LinkedIn profile
- Click the blue or green button
- Should work instantly (no Vercel deploy wait!)
- Check console (F12) for debug logs

---

## Switching Back to Production

When you're done debugging, change the API_BASE_URL back:
```javascript
const API_BASE_URL = "https://linked-in-nu-virid.vercel.app";  // Production
```

Then reload the extension.

---

## Debugging Tips

1. **Check the console** (F12) for logs and errors
2. **Check the server logs** in your terminal - you'll see what requests come in
3. **Test the API directly** with curl:
   ```bash
   curl -X POST http://localhost:3000/health
   ```

4. **If server crashes**, just restart it - changes are instant!

---

## Common Issues

**Q: "Cannot find module 'express'"**
- Run: `npm install express`

**Q: "Claude API key not configured"**
- Make sure you ran: `export Claude=sk-ant-xxxxx`
- Check with: `echo $Claude`

**Q: API returns errors**
- Check the server logs for details
- Make sure your Claude API key is valid
- Make sure you're on a LinkedIn profile when testing

**Q: Extensions still calling production**
- Make sure you changed the API_BASE_URL in popup.js
- Hard reload the extension (Ctrl+Shift+R or right-click > Reload)
