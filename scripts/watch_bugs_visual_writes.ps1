param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$TargetRelativePath = "bugs_visual.md",
  [string]$LogPath = "",
  [int]$DebounceMs = 1200,
  [int]$DurationMinutes = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $LogPath) {
  $LogPath = Join-Path $RepoRoot "logs\\bugs_visual_write_watch.log"
}

$targetPath = Join-Path $RepoRoot $TargetRelativePath
if (-not (Test-Path -LiteralPath $targetPath)) {
  throw "Target file not found: $targetPath"
}

$logDir = Split-Path -Parent $LogPath
if (-not (Test-Path -LiteralPath $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

function Write-Log {
  param([string]$Message)
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
  $line = "[$stamp] $Message"
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
  Write-Host $line
}

function Get-GitFileState {
  param(
    [string]$Repo,
    [string]$RelativePath
  )

  Push-Location $Repo
  try {
    $status = git status --short -- "$RelativePath" 2>$null
    $diff = git diff --unified=0 -- "$RelativePath" 2>$null
  }
  finally {
    Pop-Location
  }

  $compactDiff = @()
  if ($diff) {
    $compactDiff = $diff | Select-Object -First 40
  }

  return [PSCustomObject]@{
    Status = ($status -join "`n")
    Diff   = ($compactDiff -join "`n")
  }
}

function Get-ProcessCandidates {
  param([string]$Repo)

  $repoLeaf = Split-Path -Leaf $Repo
  $pattern = [regex]::Escape($repoLeaf) + "|bugs_visual\\.md|recovery_dev_execute|cursor|codex|powershell|node|cmd|gitWorker"

  $rows = Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match $pattern) } |
    Select-Object ProcessId, ParentProcessId, Name, CommandLine

  return ($rows | Select-Object -First 30 | Format-Table -AutoSize | Out-String).TrimEnd()
}

function Snapshot-Write {
  param(
    [string]$Path,
    [string]$Repo,
    [string]$RelativePath,
    [int]$Debounce
  )

  Start-Sleep -Milliseconds $Debounce

  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Log "WRITE EVENT: target missing -> $Path"
    return
  }

  $item = Get-Item -LiteralPath $Path
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
  $git = Get-GitFileState -Repo $Repo -RelativePath $RelativePath
  $procs = Get-ProcessCandidates -Repo $Repo

  Write-Log "WRITE EVENT: path=$Path | size=$($item.Length) | lastWrite=$($item.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss.fff")) | sha256=$hash"
  if ($git.Status) {
    Write-Log "GIT STATUS: $($git.Status)"
  } else {
    Write-Log "GIT STATUS: clean for $RelativePath"
  }
  if ($git.Diff) {
    Write-Log "GIT DIFF (first 40 lines):`n$($git.Diff)"
  }
  Write-Log "PROCESS SNAPSHOT (top 30):`n$procs"
  Write-Log ("-" * 120)
}

$parent = Split-Path -Parent $targetPath
$name = Split-Path -Leaf $targetPath

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $parent
$watcher.Filter = $name
$watcher.NotifyFilter = [IO.NotifyFilters]'FileName, LastWrite, Size'
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true

$messageData = @{
  Path = $targetPath
  Repo = $RepoRoot
  RelativePath = $TargetRelativePath
  Debounce = $DebounceMs
}

$onChange = {
  Snapshot-Write -Path $event.MessageData.Path `
    -Repo $event.MessageData.Repo `
    -RelativePath $event.MessageData.RelativePath `
    -Debounce $event.MessageData.Debounce
}

Register-ObjectEvent -InputObject $watcher -EventName Changed -SourceIdentifier "bugs_visual_changed" -MessageData $messageData -Action $onChange | Out-Null
Register-ObjectEvent -InputObject $watcher -EventName Created -SourceIdentifier "bugs_visual_created" -MessageData $messageData -Action $onChange | Out-Null
Register-ObjectEvent -InputObject $watcher -EventName Renamed -SourceIdentifier "bugs_visual_renamed" -MessageData $messageData -Action $onChange | Out-Null

Write-Log "Watcher started for $targetPath"
Write-Log "Log file: $LogPath"
if ($DurationMinutes -gt 0) {
  Write-Log "Duration mode: $DurationMinutes minute(s)."
} else {
  Write-Log "Duration mode: infinite (Ctrl+C to stop)."
}
Write-Log ("-" * 120)

$endAt = if ($DurationMinutes -gt 0) { (Get-Date).AddMinutes($DurationMinutes) } else { [datetime]::MaxValue }

try {
  while ((Get-Date) -lt $endAt) {
    Wait-Event -Timeout 1 | Out-Null
  }
}
finally {
  Unregister-Event -SourceIdentifier "bugs_visual_changed" -ErrorAction SilentlyContinue
  Unregister-Event -SourceIdentifier "bugs_visual_created" -ErrorAction SilentlyContinue
  Unregister-Event -SourceIdentifier "bugs_visual_renamed" -ErrorAction SilentlyContinue
  $watcher.Dispose()
  Write-Log "Watcher stopped."
}
