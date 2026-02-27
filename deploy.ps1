# deploy.ps1
# Automated Deployment Script for Tadpole OS -> Linux Lite Sandbox
# Supports rollback on failure by tagging the previous image before rebuild.

$remoteHost = "tadpole-linux" # Uses ~/.ssh/config alias for passwordless entry
$remoteDir = "~/Desktop/tadpole-os"
$tarFile = "tadpole-deploy.tar"

Write-Host "[DEPLOY] Starting Tadpole OS Deployment to $remoteHost..." -ForegroundColor Cyan

# Step 1: Build Frontend LOCALLY (to save memory on the bunker)
Write-Host "[DEPLOY] Building frontend locally..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to build frontend." -ForegroundColor Red
    exit 1
}

# Step 2: Package the codebase (Excluding dev artifacts, databases, and agent sandboxes)
Write-Host "[DEPLOY] Packaging codebase (excluding node_modules, .git, target, databases, workspaces)..." -ForegroundColor Yellow
tar.exe -cf $tarFile `
    --exclude="node_modules" `
    --exclude=".git" `
    --exclude="target" `
    --exclude="$tarFile" `
    --exclude="*.db" `
    --exclude="*.db-wal" `
    --exclude="*.db-shm" `
    --exclude="workspaces" `
    --exclude="server-rs/.sqlx" `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to package codebase." -ForegroundColor Red
    exit 1
}

# Step 3: Transfer the package via SCP
Write-Host "[DEPLOY] Transferring package via Passwordless SCP..." -ForegroundColor Yellow
scp.exe $tarFile "$($remoteHost):$remoteDir/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to transfer package. Check your connection." -ForegroundColor Red
    Remove-Item $tarFile -ErrorAction SilentlyContinue
    exit 1
}

# Step 3: Tag previous image for rollback, then rebuild
Write-Host "[DEPLOY] Triggering remote Docker rebuild on Swarm Bunker..." -ForegroundColor Yellow

# Tag the current running image as :rollback before building a new one.
# If the new build fails, we can quickly revert with `docker compose down && docker run tadpole-os:rollback`.
$sshCommand = @"
cd $remoteDir && \
tar -xf $tarFile && rm $tarFile && \
echo '--- Tagging current image for rollback ---' && \
docker tag tadpole-os:latest tadpole-os:rollback 2>/dev/null || true && \
echo '--- Building new image ---' && \
docker compose build && \
echo '--- Starting new container ---' && \
docker compose up -d && \
echo '--- Verifying health ---' && \
sleep 15 && \
if curl -sf http://localhost:8000/engine/health > /dev/null 2>&1; then \
    echo 'Health check passed!'; \
else \
    echo 'HEALTH CHECK FAILED — rolling back...' && \
    docker compose down && \
    if docker image inspect tadpole-os:rollback > /dev/null 2>&1; then \
        docker tag tadpole-os:rollback tadpole-os:latest && \
        docker compose up -d && \
        echo 'Rolled back to previous version.'; \
    else \
        echo 'No rollback image found. Cannot rollback.'; \
    fi && \
    exit 1; \
fi
"@

ssh.exe $remoteHost ($sshCommand.Replace("`r", ""))
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Deployment failed or was rolled back. Check the remote logs." -ForegroundColor Red
}
else {
    Write-Host "[SUCCESS] Deployment Successful! Tadpole OS is live on the Swarm Bunker." -ForegroundColor Green
}

# Cleanup locally
Write-Host "[DEPLOY] Cleaning up local temporary files..." -ForegroundColor DarkGray
Remove-Item $tarFile -ErrorAction SilentlyContinue

Write-Host "[DONE] Deployment complete." -ForegroundColor Cyan
