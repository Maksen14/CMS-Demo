# PowerShell script to install Redis on Windows using WSL
Write-Host "Installing Redis on Windows using WSL" -ForegroundColor Green

# Check if WSL is enabled
$wslEnabled = wsl --list | Select-String -Pattern "Ubuntu"
if (-not $wslEnabled) {
    Write-Host "WSL not detected. Installing WSL and Ubuntu..." -ForegroundColor Yellow
    
    # Install WSL
    Write-Host "Enabling WSL feature..." -ForegroundColor Cyan
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    
    # Enable Virtual Machine Platform
    Write-Host "Enabling Virtual Machine Platform..." -ForegroundColor Cyan
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
    
    # Set WSL 2 as default
    Write-Host "Setting WSL 2 as default..." -ForegroundColor Cyan
    wsl --set-default-version 2
    
    Write-Host "Please restart your computer, then install Ubuntu from the Microsoft Store." -ForegroundColor Red
    Write-Host "After installing Ubuntu, run this script again to install Redis." -ForegroundColor Red
    Exit
}

# Install Redis in WSL Ubuntu
Write-Host "Installing Redis in WSL Ubuntu..." -ForegroundColor Cyan
wsl bash -c "sudo apt update && sudo apt install -y redis-server"

# Start Redis service
Write-Host "Starting Redis service..." -ForegroundColor Cyan
wsl bash -c "sudo service redis-server start"

# Enable Redis service to start on boot
Write-Host "Enabling Redis service to start on boot..." -ForegroundColor Cyan
wsl bash -c "sudo systemctl enable redis-server"

# Verify Redis is running
Write-Host "Verifying Redis is running..." -ForegroundColor Cyan
$redisRunning = wsl bash -c "redis-cli ping" | Select-String -Pattern "PONG"
if ($redisRunning) {
    Write-Host "Redis is installed and running successfully!" -ForegroundColor Green
    Write-Host "You can now use Redis with your application." -ForegroundColor Green
} else {
    Write-Host "Redis might not be running. Please check manually with 'wsl redis-cli ping'" -ForegroundColor Yellow
}

# Configure access from Windows
Write-Host "Configuring Redis to allow access from Windows..." -ForegroundColor Cyan
wsl bash -c "sudo sed -i 's/bind 127.0.0.1/bind 0.0.0.0/' /etc/redis/redis.conf && sudo service redis-server restart"

# Get WSL IP address
$wslIp = wsl bash -c "ip addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}'" | Select-String -Pattern "\d+\.\d+\.\d+\.\d+"
Write-Host "Your WSL IP address is: $wslIp" -ForegroundColor Green
Write-Host "Update your .env file with this Redis URL:" -ForegroundColor Green
Write-Host "REDIS_URL=redis://$wslIp`:6379" -ForegroundColor Cyan

# Instructions
Write-Host "`nTo manually start/stop Redis:" -ForegroundColor Magenta
Write-Host "  Start Redis: wsl sudo service redis-server start" -ForegroundColor White
Write-Host "  Stop Redis: wsl sudo service redis-server stop" -ForegroundColor White
Write-Host "  Restart Redis: wsl sudo service redis-server restart" -ForegroundColor White
Write-Host "  Check Redis status: wsl sudo service redis-server status" -ForegroundColor White
Write-Host "  Test Redis: wsl redis-cli ping" -ForegroundColor White 