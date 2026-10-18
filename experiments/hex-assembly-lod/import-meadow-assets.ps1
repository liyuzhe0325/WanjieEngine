# One-time registration of previously generated meadow GLB into Git.
# Usage: powershell -ExecutionPolicy Bypass -File .\experiments\hex-assembly-lod\import-meadow-assets.ps1 -Archive "C:\Users\...\Downloads\Wanjie_Meadow_Viewer.zip"
[CmdletBinding()]
param([string]$Archive)
$ErrorActionPreference = 'Stop'
$repo = (git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $repo) { throw 'Please run inside the WanjieEngine git working tree.' }
$repo = $repo.Trim()
if ((git branch --show-current).Trim() -ne 'main') { throw 'Switch to main first: git switch main' }
$changed = @(git status --porcelain --untracked-files=no)
if ($changed.Count -gt 0) { throw 'Tracked files have local changes. Commit or stash those changes first.' }
$dest = Join-Path $repo 'experiments\hex-assembly-lod\models'
$patterns = @('lod85.glb','lod40.glb','lod22.glb','lod10.glb')
$destNames = @('meadow_lod1.glb','meadow_lod2.glb','meadow_lod3.glb','meadow_lod4.glb')
if (-not $Archive) {
  $downloads = Join-Path $env:USERPROFILE 'Downloads'
  $matches = @(Get-ChildItem -LiteralPath $downloads -Filter 'Wanjie_Meadow_Viewer*.zip' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
  if ($matches.Count -eq 0) { throw "Cannot find Wanjie_Meadow_Viewer.zip in Downloads. Pass -Archive <full path>." }
  $Archive = $matches[0].FullName
}
if (-not (Test-Path -LiteralPath $Archive -PathType Leaf)) { throw "ZIP not found: $Archive" }
$archiveResolved = (Resolve-Path -LiteralPath $Archive).Path
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ('wanjie-meadow-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
try {
  Expand-Archive -LiteralPath $archiveResolved -DestinationPath $temp -Force
  $all = @(Get-ChildItem -LiteralPath $temp -Recurse -File -Filter '*.glb')
  $pairs = @()
  for($i=0;$i -lt $patterns.Count;$i++){
    $candidate = @($all | Where-Object { $_.Name -eq $patterns[$i] })
    if ($candidate.Count -ne 1) { throw "Expected exactly one $($patterns[$i]) in archive, found $($candidate.Count)." }
    $src=$candidate[0]
    if ($src.Length -lt 100000 -or $src.Length -gt 20000000) { throw "Suspicious model size: $($src.Name) = $($src.Length) bytes" }
    $stream=[System.IO.File]::OpenRead($src.FullName)
    try {
      $magic=New-Object byte[] 4
      if ($stream.Read($magic,0,4) -ne 4 -or [System.Text.Encoding]::ASCII.GetString($magic) -ne 'glTF') {
        throw "Not a valid GLB header: $($src.Name)"
      }
    } finally {$stream.Dispose()}
    $target=Join-Path $dest $destNames[$i]
    if (Test-Path -LiteralPath $target) { throw "Destination exists; refusing to overwrite: $target" }
    $pairs += [pscustomobject]@{ Source = $src.FullName; Target = $target }
  }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  foreach($pair in $pairs){ Copy-Item -LiteralPath $pair.Source -Destination $pair.Target }
  git -C $repo add -- experiments/hex-assembly-lod/models/meadow_lod1.glb experiments/hex-assembly-lod/models/meadow_lod2.glb experiments/hex-assembly-lod/models/meadow_lod3.glb experiments/hex-assembly-lod/models/meadow_lod4.glb
  if ($LASTEXITCODE -ne 0) { throw 'git add failed; verify .gitignore or permissions.' }
  Write-Host 'Prepared four meadow models. Review staged file sizes:'
  git -C $repo diff --cached --stat
  Write-Host ''
  Write-Host 'To finish the one-time upload, run:'
  Write-Host '  git commit -m "assets: add four meadow LOD GLBs"'
  Write-Host '  git push origin main'
  Write-Host 'Existing base/wasteland models were not touched.'
} finally {
  Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}
