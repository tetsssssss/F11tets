$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$publishRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'dist-netlify'))
if (-not (Test-Path -LiteralPath (Join-Path $publishRoot 'index.html'))) { throw 'Build Netlify ausente.' }
Copy-Item -LiteralPath (Join-Path $projectRoot 'NETLIFY_LEIA-ME.txt') -Destination (Join-Path $publishRoot 'LEIA-ME.txt')
foreach ($report in @('VISUAL_AND_2D_STATUS.md','NEXT_AGENT_HANDOFF.md','PHOTO_AUDIT_REPORT.md','FOTOS_FALTANTES.txt','F1_UNIVERSE_STATUS.md')) {
 if(Test-Path -LiteralPath (Join-Path $projectRoot $report)) { Copy-Item -LiteralPath (Join-Path $projectRoot $report) -Destination (Join-Path $publishRoot $report) }
}
$releaseRoot = Join-Path $projectRoot 'releases'
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
$zipPath = Join-Path $releaseRoot 'F1_UNIVERSE_2029_NETLIFY.zip'
if(Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($publishRoot,$zipPath,[IO.Compression.CompressionLevel]::Optimal,$false)
$archive=[IO.Compression.ZipFile]::OpenRead($zipPath)
try {
 $names=@($archive.Entries | ForEach-Object { $_.FullName.Replace('\','/') })
 foreach($required in @('index.html','_redirects','LEIA-ME.txt','assets/people/PHOTO_SOURCES.json')){if($required -notin $names){throw "Arquivo ausente: $required"}}
 if(@($names | Where-Object {$_ -match 'node_modules|\.env|\.git/|high-resolution|tenis/'}).Count){throw 'Conteúdo indevido no ZIP.'}
 $photos=@($names | Where-Object {$_ -match '^assets/people/drivers/.*_card.webp$'}).Count
 if($photos -ne 32){throw "Cobertura de fotos incorreta: $photos"}
 [pscustomobject]@{file=$zipPath;files=$names.Count;driverCards=$photos;bytes=(Get-Item -LiteralPath $zipPath).Length;sha256=(Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectRoot 'docs/netlify-package.json')
 Get-Content -LiteralPath (Join-Path $projectRoot 'docs/netlify-package.json')
} finally { $archive.Dispose() }
