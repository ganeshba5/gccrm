# Network Access Guide

This guide explains how to access the CRM application from other devices on your local network.

## Quick Start

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Find your computer's IP address:**
   - **macOS/Linux**: Run `ifconfig` or `ip addr` in terminal
   - **Windows**: Run `ipconfig` in Command Prompt
   - Look for your local network IP (usually starts with `192.168.x.x` or `10.x.x.x`)

3. **Access from another device:**
   - Open a browser on the other PC
   - Navigate to: `http://YOUR_IP_ADDRESS:5173`
   - Example: `http://192.168.1.100:5173`

## Detailed Instructions

### Step 1: Start the Development Server

The Vite configuration has been updated to listen on all network interfaces (`0.0.0.0`), which allows access from other devices.

```bash
npm run dev
```

You should see output like:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.100:5173/
  ➜  press h + enter to show help
```

The "Network" URL is what you'll use from other devices.

### Step 2: Find Your IP Address

#### macOS:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Or use:
```bash
ipconfig getifaddr en0  # For Wi-Fi
ipconfig getifaddr en1  # For Ethernet
```

#### Windows:
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

#### Linux:
```bash
ip addr show
# or
hostname -I
```

### Step 3: Access from Another Device

1. Ensure both devices are on the same network (same Wi-Fi or same LAN)
2. On the other PC, open a web browser
3. Enter: `http://YOUR_IP_ADDRESS:5173`
   - Replace `YOUR_IP_ADDRESS` with the IP from Step 2
   - Example: `http://192.168.1.100:5173`

### Step 4: Firewall Configuration

If you can't access the app from another device, you may need to allow the port through your firewall.

#### macOS:
1. System Settings → Network → Firewall → Firewall Options
2. Click "+" to add an application
3. Add Node.js or Terminal
4. Or allow incoming connections on port 5173

#### Windows:
1. Windows Defender Firewall → Advanced Settings
2. Inbound Rules → New Rule
3. Port → TCP → Specific local ports: 5173
4. Allow the connection
5. Apply to all profiles

#### Linux (ufw):
```bash
sudo ufw allow 5173/tcp
```

## Production Deployment

For production use, you have several options:

### Option 1: Build and Serve Locally
```bash
npm run build
npm run preview
```
Then access via `http://YOUR_IP:4173`

### Option 2: Deploy to Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```
This will make it accessible via a public URL.

### Option 3: Use a Local Web Server
You can serve the built files using any web server:
- Python: `python -m http.server 8000` (in the `dist` folder)
- Node.js: `npx serve dist`
- Nginx/Apache: Configure to serve the `dist` folder

## Troubleshooting

### Can't access from another device?

1. **Check firewall settings** (see Step 4 above)
2. **Verify both devices are on the same network**
3. **Check the IP address** - Make sure you're using the correct network interface IP
4. **Try disabling firewall temporarily** to test if that's the issue
5. **Check Vite output** - It should show the Network URL

### Port already in use?

If port 5173 is already in use, Vite will automatically try the next available port. Check the terminal output for the actual port number.

To specify a different port:
```bash
npm run dev -- --port 3000
```

### Connection refused?

- Ensure the dev server is running
- Check that you're using the correct IP address
- Verify firewall allows the connection
- Try accessing from the same machine first: `http://localhost:5173`

## Security Considerations

⚠️ **Important**: When running in development mode on a network:

1. **Development mode is not secure** - Don't use for production data
2. **Anyone on your network can access** - Ensure your network is trusted
3. **No HTTPS** - Data is transmitted over HTTP (not encrypted)
4. **Firebase security rules** still apply - Authentication is still required

For production use, deploy to Firebase Hosting or another secure hosting service.

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (accessible on network) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build (also network accessible) |
| `ifconfig` (macOS/Linux) | Find IP address |
| `ipconfig` (Windows) | Find IP address |

## Example Workflow

1. On your development machine:
   ```bash
   cd /Users/ganeshb/Documents/CursorAI/GCCrm/gccrmapp
   npm run dev
   ```
   Note the Network URL (e.g., `http://192.168.1.100:5173`)

2. On another PC in the workgroup:
   - Open browser
   - Go to `http://192.168.1.100:5173`
   - Login and use the CRM

3. Both devices can use the app simultaneously!

