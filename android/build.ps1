param([string]$Sdk="$env:LOCALAPPDATA/Android/Sdk",[string]$Java="C:/Program Files/Android/Android Studio/jbr",[string]$BuildDir="")
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
& python (Join-Path $project 'scripts/check_assets.py')
if($LASTEXITCODE -ne 0){throw 'Offline assets are incomplete. Restore the tile bundle first.'}
if(-not $BuildDir){$BuildDir=Join-Path $project 'build/android'}
$BuildDir=[IO.Path]::GetFullPath($BuildDir)
New-Item -ItemType Directory -Force -Path $BuildDir,"$BuildDir/classes","$BuildDir/dex","$BuildDir/assets/www" | Out-Null
$bt=Join-Path $Sdk 'build-tools/35.0.0'
$platform=Join-Path $BuildDir 'android.jar'
Copy-Item -LiteralPath (Join-Path $Sdk 'platforms/android-34/android.jar') -Destination $platform -Force
$env:JAVA_HOME=$Java
$env:Path="$Java/bin;"+$env:Path
function Run([string]$Exe,[string[]]$Arguments){& $Exe @Arguments;if($LASTEXITCODE -ne 0){throw "Command failed: $Exe ($LASTEXITCODE)"}}
Copy-Item -Path "$project/www/*" -Destination "$BuildDir/assets/www" -Recurse -Force
Run "$bt/aapt2.exe" @('compile','--dir',"$PSScriptRoot/res",'-o',"$BuildDir/resources.zip")
Run "$bt/aapt2.exe" @('link','-o',"$BuildDir/base.apk",'-I',$platform,'--manifest',"$PSScriptRoot/AndroidManifest.xml",'-A',"$BuildDir/assets",'-R',"$BuildDir/resources.zip")
Run "$Java/bin/javac.exe" @('-encoding','UTF-8','-source','8','-target','8','-classpath',$platform,'-d',"$BuildDir/classes","$PSScriptRoot/src/kr/offline/gyeot/MainActivity.java")
$classFiles=@(Get-ChildItem "$BuildDir/classes" -Recurse -Filter '*.class' | ForEach-Object FullName)
Run "$bt/d8.bat" (@('--lib',$platform,'--min-api','26','--output',"$BuildDir/dex")+$classFiles)
Copy-Item "$BuildDir/base.apk" "$BuildDir/unsigned.apk" -Force
Run "$Java/bin/jar.exe" @('uf',"$BuildDir/unsigned.apk",'-C',"$BuildDir/dex",'classes.dex')
Run "$bt/zipalign.exe" @('-f','4',"$BuildDir/unsigned.apk","$BuildDir/aligned.apk")
$key=Join-Path $BuildDir 'development-signing.p12'
if(-not(Test-Path $key)){Run "$Java/bin/keytool.exe" @('-genkeypair','-keystore',$key,'-storepass','android','-keypass','android','-alias','gyeot-development','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Gyeot Development, O=Local Development, C=KR')}
$dist=Join-Path $project 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$apk=Join-Path $dist 'gyeot-android-preview.apk'
Run "$bt/apksigner.bat" @('sign','--ks',$key,'--ks-key-alias','gyeot-development','--ks-pass','pass:android','--key-pass','pass:android','--out',$apk,"$BuildDir/aligned.apk")
Run "$bt/apksigner.bat" @('verify','--verbose',$apk)
Write-Output "APK: $apk"
