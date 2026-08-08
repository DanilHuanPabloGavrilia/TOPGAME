# Packs dist/ into the archive the game portals accept.
#
# Do NOT replace this with Compress-Archive. On PowerShell 5.1 it writes entry paths with a
# backslash separator (assets\index.js), which violates the ZIP spec: the portals unpack on
# Linux, where that is read as a filename rather than a folder, and every asset 404s.
# Entries here are created explicitly with '/' and the result is asserted before it ships.
#
# ASCII only, deliberately. PowerShell 5.1 reads a .ps1 without a BOM as ANSI, so any
# non-ASCII character in this file (an em dash, a quote) comes back mangled and the script
# fails to parse.

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'dist'
$zipPath = Join-Path $root 'dealers-gambit-release.zip'

if (-not (Test-Path $src)) { throw "No dist to pack. Run 'npm run build' first." }
if (-not (Test-Path (Join-Path $src 'index.html'))) { throw 'dist has no index.html.' }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
try {
  $prefix = (Resolve-Path $src).Path.TrimEnd('\') + '\'
  foreach ($file in Get-ChildItem -Path $src -Recurse -File) {
    $entryName = $file.FullName.Substring($prefix.Length).Replace('\', '/')
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal)
  }
} finally {
  $zip.Dispose()
}

# Verify rather than trust: reopen and refuse to leave a broken archive on disk.
$check = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $bad = @($check.Entries | Where-Object { $_.FullName -like '*\*' })
  $count = $check.Entries.Count
  $hasIndex = @($check.Entries | Where-Object { $_.FullName -eq 'index.html' }).Count -eq 1
} finally {
  $check.Dispose()
}

if ($bad.Count -gt 0) {
  Remove-Item $zipPath -Force
  throw "$($bad.Count) entries used a backslash separator. Archive deleted."
}
if (-not $hasIndex) {
  Remove-Item $zipPath -Force
  throw 'index.html is not at the archive root. Archive deleted.'
}

$sizeKb = [math]::Round((Get-Item $zipPath).Length / 1KB, 1)
Write-Output "OK: $count entries, index.html at root, 0 backslash paths, $sizeKb KB"
Write-Output $zipPath
