param(
    [string]$Nombre = "OrcaGest-$(Get-Date -Format 'yyyy-MM-dd')-asignacion-cajas.apk",
    [string]$Arquitecturas = 'arm64-v8a,armeabi-v7a'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if ([IO.Path]::GetFileName($Nombre) -ne $Nombre -or -not $Nombre.EndsWith('.apk')) {
    throw 'Indica un nombre de archivo APK, sin directorios.'
}
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) { throw 'No se encontro el JDK. Configura JAVA_HOME.' }
if (-not (Test-Path -LiteralPath $env:ANDROID_HOME)) { throw 'No se encontro el SDK. Configura ANDROID_HOME.' }
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:NODE_ENV = 'production'
$env:CMAKE_BUILD_PARALLEL_LEVEL = '2'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:ORCAGEST_CXX_DIR = Join-Path ([IO.Path]::GetTempPath()) 'og-cxx'
New-Item -ItemType Directory -Path $env:ORCAGEST_CXX_DIR -Force | Out-Null
$drive = @('R:', 'S:', 'T:', 'U:', 'V:', 'W:', 'X:', 'Y:', 'Z:') | Where-Object {
    ($_.Substring(0, 2) + '\') -notin [IO.Directory]::GetLogicalDrives()
} | Select-Object -First 1
if (-not $drive) { throw 'No hay una letra de unidad libre para las rutas temporales nativas.' }
& subst.exe $drive $env:ORCAGEST_CXX_DIR
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el alias temporal para CMake.' }
$env:ORCAGEST_APP_CXX_DIR = $drive + '\app'
$init = Join-Path $env:ORCAGEST_CXX_DIR 'short-paths.gradle'

# Mantiene los archivos nativos fuera de las rutas largas de node_modules en Windows.
@'
gradle.beforeProject { p ->
    ['com.android.library', 'com.android.application'].each { plugin ->
        p.pluginManager.withPlugin(plugin) {
            def aliases = ['expo-modules-core': 'ec', 'react-native-reanimated': 'ra', 'react-native-worklets': 'rw', 'app': 'app']
            def name = aliases[p.name] ?: p.name.replaceAll('[^A-Za-z0-9_]', '_')
            p.android.externalNativeBuild.cmake.buildStagingDirectory = p.name == 'app' ? new File(System.getenv('ORCAGEST_APP_CXX_DIR')) : new File(System.getenv('ORCAGEST_CXX_DIR'), name)
            p.android.defaultConfig.externalNativeBuild.cmake.arguments.add(p.name == 'app' ? '-DCMAKE_OBJECT_PATH_MAX=250' : '-DCMAKE_OBJECT_PATH_MAX=200')
        }
    }
}
'@ | Set-Content -LiteralPath $init -Encoding ASCII

Push-Location (Join-Path $root 'android')
try {
    & .\gradlew.bat assembleRelease --no-daemon --no-parallel --max-workers=1 --console=plain --init-script $init "-PreactNativeArchitectures=$Arquitecturas"
    if ($LASTEXITCODE -ne 0) { throw "La compilacion fallo con codigo $LASTEXITCODE." }
} finally {
    Pop-Location
    & subst.exe $drive /D | Out-Null
}

$source = Join-Path $root 'android\app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path -LiteralPath $source)) { throw 'Gradle no genero el APK esperado.' }
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$dest = Join-Path $dist $Nombre
if (Test-Path -LiteralPath $dest) {
    $dest = Join-Path $dist ($Nombre.Substring(0, $Nombre.Length - 4) + '-' + (Get-Date -Format 'HHmmss') + '.apk')
}
Copy-Item -LiteralPath $source -Destination $dest
Get-Item -LiteralPath $dest | Select-Object FullName, Length, LastWriteTime
Get-FileHash -LiteralPath $dest -Algorithm SHA256
