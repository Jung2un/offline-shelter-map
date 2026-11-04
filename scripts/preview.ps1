param([int]$Port=8766)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
& python (Join-Path $PSScriptRoot 'check_assets.py')
if($LASTEXITCODE -ne 0){throw 'Restore offline map assets first.'}
& python -m http.server $Port --bind 127.0.0.1 --directory (Join-Path $root 'www')
