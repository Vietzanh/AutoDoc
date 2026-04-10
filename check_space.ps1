Get-Process python*,node* -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Processes killed"
Get-PSDrive C | Format-Table Name, Used, Free -AutoSize
