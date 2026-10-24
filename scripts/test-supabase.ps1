<#
.SYNOPSIS
  Supabase Connection Diagnostic Tool (PowerShell version)
.EXAMPLE
  .\scripts\test-supabase.ps1
  .\scripts\test-supabase.ps1 -Url "https://xyz.supabase.co" -AnonKey "eyJ..."
#>
param(
  [string]$Url = $env:VITE_SUPABASE_URL,
  [string]$AnonKey = $env:VITE_SUPABASE_ANON_KEY
)

if (-not $Url) { $Url = $env:SUPABASE_URL }
if (-not $AnonKey) { $AnonKey = $env:SUPABASE_ANON_KEY }

Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "       SUPABASE CONNECTION & MIGRATION DIAGNOSTIC      " -ForegroundColor Cyan
Write-Host "======================================================`n" -ForegroundColor Cyan

$allPassed = $true

# 1. URL Check
if (-not $Url) {
  Write-Host "❌ [FAIL] Missing SUPABASE_URL / VITE_SUPABASE_URL." -ForegroundColor Red
  Write-Host "   Action: Add VITE_SUPABASE_URL to your Vercel Project Settings." -ForegroundColor Yellow
  $allPassed = $false
} else {
  Write-Host "✅ [PASS] Supabase URL detected." -ForegroundColor Green
}

# 2. Key Check
if (-not $AnonKey) {
  Write-Host "❌ [FAIL] Missing SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY." -ForegroundColor Red
  Write-Host "   Action: Copy the 'anon' public key from Supabase Dashboard -> Settings -> API." -ForegroundColor Yellow
  $allPassed = $false
} else {
  Write-Host "✅ [PASS] Anon Key detected." -ForegroundColor Green
}

if (-not $Url -or -not $AnonKey) {
  Write-Host "`nAborting further tests due to missing credentials." -ForegroundColor Red
  exit 1
}

# 3. REST API & Table Check
Write-Host "`nTesting REST API & 'backgrounds' table..." -ForegroundColor Cyan
$cleanUrl = $Url.TrimEnd('/')
$restUrl = "$cleanUrl/rest/v1/backgrounds?select=id,name_en,category,is_active&limit=5"
$headers = @{
  "apikey" = $AnonKey
  "Authorization" = "Bearer $AnonKey"
  "Content-Type" = "application/json"
}

try {
  $resp = Invoke-RestMethod -Uri $restUrl -Headers $headers -Method Get -ErrorAction Stop
  Write-Host "✅ [PASS] Connected to Supabase PostgREST API!" -ForegroundColor Green
  Write-Host "✅ [PASS] Successfully queried 'backgrounds' table. Found $($resp.Count) row(s)." -ForegroundColor Green
  if ($resp.Count -gt 0) {
    foreach ($r in $resp) {
      Write-Host "   - [$($r.category)] $($r.name_en) (active: $($r.is_active))" -ForegroundColor Gray
    }
  } else {
    Write-Host "   ℹ️ Table exists but is currently empty." -ForegroundColor Yellow
  }
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -eq 401) {
    Write-Host "❌ [FAIL] HTTP 401 Unauthorized: Invalid or mismatched Anon Key." -ForegroundColor Red
  } elseif ($status -eq 404 -or $status -eq 400) {
    Write-Host "❌ [FAIL] HTTP $status: Table 'backgrounds' does not exist in public schema." -ForegroundColor Red
    Write-Host "   Action: Apply 'supabase/schema.sql' in Supabase SQL Editor." -ForegroundColor Yellow
  } else {
    Write-Host "❌ [FAIL] Error connecting to Supabase: $_" -ForegroundColor Red
  }
  $allPassed = $false
}

# 4. Storage Bucket Check
Write-Host "`nTesting Storage bucket 'ambient-backgrounds'..." -ForegroundColor Cyan
$bucketUrl = "$cleanUrl/storage/v1/bucket/ambient-backgrounds"
try {
  $bResp = Invoke-RestMethod -Uri $bucketUrl -Headers $headers -Method Get -ErrorAction Stop
  Write-Host "✅ [PASS] Storage bucket 'ambient-backgrounds' exists!" -ForegroundColor Green
  if ($bResp.public -eq $true) {
    Write-Host "✅ [PASS] Bucket is PUBLIC (ready for mobile streaming)." -ForegroundColor Green
  } else {
    Write-Host "⚠️ [WARN] Bucket is PRIVATE. Mobile devices will not be able to load videos!" -ForegroundColor Yellow
    Write-Host "   Action: Go to Storage -> Buckets -> Edit Bucket -> Make Public." -ForegroundColor Yellow
  }
} catch {
  Write-Host "⚠️ [INFO] Could not probe bucket endpoint directly: $_" -ForegroundColor Yellow
  Write-Host "   Ensure 'ambient-backgrounds' bucket exists and is marked Public." -ForegroundColor Yellow
}

Write-Host "`n======================================================" -ForegroundColor Cyan
if ($allPassed) {
  Write-Host "🎉 ALL SUPABASE CHECKS PASSED! Ready for Stage (a)." -ForegroundColor Green
} else {
  Write-Host "⚠️ Review failures above." -ForegroundColor Yellow
}
Write-Host "======================================================`n" -ForegroundColor Cyan
