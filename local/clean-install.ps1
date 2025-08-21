# Remove all node_modules folders recursively
Get-ChildItem -Path . -Directory -Recurse -Force -Filter "node_modules" | ForEach-Object {
    Remove-Item -Path $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "Removed all node_modules folders recursively"

# Remove the package-lock.json file in the root directory
Remove-Item -Path .\package-lock.json -Force -ErrorAction SilentlyContinue
Write-Host "Removed package-lock.json"

# Run npm install
npm install
Write-Host "Installed dependencies"