param(
    [Parameter(Mandatory = $true)][string]$Apk,
    [string]$Credenciales = '',
    [string]$ApkAnterior = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $Credenciales) { $Credenciales = Join-Path $root 'credentials.json' }
$Credenciales = (Get-Item -LiteralPath $Credenciales).FullName
$Apk = (Get-Item -LiteralPath $Apk).FullName
$keys = (Get-Content -LiteralPath $Credenciales -Raw | ConvertFrom-Json).android.keystore
foreach ($field in @('keystorePath', 'keystorePassword', 'keyAlias', 'keyPassword')) {
    if (-not $keys.$field) { throw "Falta android.keystore.$field en las credenciales locales." }
}
$keystore = $keys.keystorePath
if (-not [IO.Path]::IsPathRooted($keystore)) {
    $keystore = Join-Path (Split-Path -Parent $Credenciales) $keystore
}
if (-not (Test-Path -LiteralPath $keystore)) { throw 'No se encontro la clave de firma local.' }
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$signer = Join-Path $env:ANDROID_HOME 'build-tools\36.0.0\apksigner.bat'
if (-not (Test-Path -LiteralPath $signer)) { throw 'No se encontro apksigner de Android Build Tools 36.0.0.' }

function Get-ApkCertificate([string]$Path) {
    $result = & $signer verify --print-certs $Path
    if ($LASTEXITCODE -ne 0) { throw 'La verificacion de firma del APK fallo.' }
    $line = @($result | Select-String '^Signer #1 certificate SHA-256 digest:')[0]
    if (-not $line) { throw 'No se pudo obtener el certificado del APK.' }
    return ($line.Line -replace '^.*digest:\s*', '').Trim().ToLowerInvariant()
}

$signed = Join-Path (Split-Path -Parent $Apk) ('.signed-' + [guid]::NewGuid().ToString('N') + '.apk')
$oldStore = $env:ORCAGEST_STORE_PASSWORD
$oldKey = $env:ORCAGEST_KEY_PASSWORD
try {
    # Las contrasenas no se escriben en comandos, logs ni archivos de salida.
    $env:ORCAGEST_STORE_PASSWORD = $keys.keystorePassword
    $env:ORCAGEST_KEY_PASSWORD = $keys.keyPassword
    & $signer sign --ks $keystore --ks-key-alias $keys.keyAlias --ks-pass env:ORCAGEST_STORE_PASSWORD --key-pass env:ORCAGEST_KEY_PASSWORD --v4-signing-enabled false --out $signed $Apk
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo firmar el APK con las credenciales locales.' }
    $certificate = Get-ApkCertificate $signed
    if ($ApkAnterior -and $certificate -ne (Get-ApkCertificate $ApkAnterior)) {
        throw 'El certificado no coincide con el APK anterior. No se reemplazo el archivo.'
    }
    Copy-Item -LiteralPath $signed -Destination $Apk -Force
    Write-Output "Firma verificada: $certificate"
} finally {
    $env:ORCAGEST_STORE_PASSWORD = $oldStore
    $env:ORCAGEST_KEY_PASSWORD = $oldKey
    if (Test-Path -LiteralPath $signed) { Remove-Item -LiteralPath $signed -Force }
}
