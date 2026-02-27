# 🚢 Tadpole OS: Deployment Guide (Swarm Bunker)

This guide details the procedure for deploying and hosting the **Tadpole OS Engine** on a Swarm Bunker from a Windows development machine.

## 📋 System Requirements

### Host (Windows Dev Machine)
- **PowerShell 7+**
- **OpenSSH Client** (integrated with Windows)
- **tar.exe** (integrated with Windows)

### Target (Swarm Bunker (Linux or Similar Sandbox for Production Deployment))
- **Docker & Docker Compose**
- **Tailscale** (Recommended for secure, zero-config networking)
- **SSH Server** (Configured for passwordless auth)

---

## 🔐 1. Security & SSH Setup

To enable the automated `deploy.ps1` script, you must configure passwordless SSH access.

1. **Generate Key Pair** (on Windows):
   ```powershell
   ssh-keygen -t ed25519
   ```
2. **Transfer Public Key**:
   Copy the contents of `~/.ssh/id_ed25519.pub` to the target's `~/.ssh/authorized_keys`.
3. **Configure SSH Alias**:
   Add the following to `C:\Users\<User>\.ssh\config`:
   ```config
   Host tadpole-linux
       HostName <TAILSCALE_IP_OR_HOSTNAME>
       User <LINUX_USER>
       IdentityFile ~/.ssh/id_ed25519
   ```

---

## 🚀 2. The Deployment Pipeline

The `deploy.ps1` script automates the entire distribution lifecycle:

### Execution
Run the following from the root of the project:
```powershell
./deploy.ps1
```

### What happens under the hood:
1.  **Packaging**: The script uses `tar` to create a lightweight deployment bundle, excluding heavy directories like `node_modules` and `target`.
2.  **Transfer**: The bundle is streamed to the Linux host via `scp`.
3.  **Rollback Protection**: 
    - The current running image is tagged as `tadpole-os:rollback`.
    - If### Monitoring & Maintenance

- **Health Checks**: The engine exposes `/engine/health`. Monitor this via Docker or specialized agents.
- **Agent Capacity**: The current sector is configured for **25 default agents**. This threshold is configurable. For massive swarms, increase the `MAX_NODES` constant in the frontend and ensure your provider's rate limits accommodate the increased concurrency of **Parallel Swarming**.
- **Log Management**: Engine logs are written to internal Docker storage. Use `docker logs tadpole-os -f` for real-time telemetry.

### Scale-up Strategy (Horizontal Expansion)
To support more than 25 agents, follow this multi-sector deployment pattern:
1. **Provision New Node**: Deploy a second instance of the Tadpole OS Engine on a separate host/port.
2. **Cluster Link**: Update the frontend `settingsStore.ts` or environment variables to point to the new sector.
3. **Registry Sync**: The global `agents.json` can be shared across sectors via a network volume if unified state is required.
an production image.

---

## 🛠️ 3. Environment Configuration

Your secrets and configurations are managed via a `.env` file on the remote host (or passed via the CI/CD environment).

**Required Variables (`.env`):**
```env
NEURAL_TOKEN=your-secure-token
GOOGLE_API_KEY=AIza...
GROQ_API_KEY=gsk_...
ALLOWED_ORIGINS=http://your-dashboard-url
```

---

## 📈 4. Monitoring & Troubleshooting

### Viewing Remote Logs
To monitor the live engine on the Linux host:
```bash
ssh tadpole-linux "cd ~/Desktop/tadpole-os && docker compose logs -f"
```

### Manual Restart
```bash
ssh tadpole-linux "cd ~/Desktop/tadpole-os && docker compose restart"
```

### Health Check Endpoint
The engine exposes a health check at:
`http://<linux-ip>:8000/engine/health`

> [!IMPORTANT]
> The engine binds to `0.0.0.0` within the container to ensure accessibility over Tailscale/Private networks. Ensure your Linux firewall allows traffic on port `8000` (Backend) and `5173` (Frontend).
