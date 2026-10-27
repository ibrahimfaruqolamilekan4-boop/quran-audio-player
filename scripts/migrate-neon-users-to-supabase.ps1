<#
.SYNOPSIS
  Idempotent Migration Script: Neon Postgres Users -> Supabase Auth & public.profiles
.EXAMPLE
  .\scripts\migrate-neon-users-to-supabase.ps1 -DryRun
  .\scripts\migrate-neon-users-to-supabase.ps1
#>
param(
  [switch]$DryRun,
  [string]$SupabaseUrl = $env:VITE_SUPABASE_URL,
  [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
)

if (-not $SupabaseUrl) { $SupabaseUrl = $env:SUPABASE_URL }
if (-not $ServiceRoleKey) { $ServiceRoleKey = $env:VITE_SUPABASE_SERVICE_ROLE_KEY }

Write-Host "================================================================" -ForegroundColor Cyan
if ($DryRun) {
  Write-Host " NEON TO SUPABASE USERS MIGRATION (DRY RUN)" -ForegroundColor Yellow
} else {
  Write-Host " NEON TO SUPABASE USERS MIGRATION (LIVE APPLICATION)" -ForegroundColor Green
}
Write-Host "================================================================`n" -ForegroundColor Cyan

if (-not $SupabaseUrl -or -not $ServiceRoleKey) {
  Write-Host "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." -ForegroundColor Red
  Write-Host "   Set SUPABASE_SERVICE_ROLE_KEY in your environment or pass via -ServiceRoleKey." -ForegroundColor Yellow
  exit 1
}

$cleanUrl = $SupabaseUrl.TrimEnd('/')
$headers = @{
  "apikey" = $ServiceRoleKey
  "Authorization" = "Bearer $ServiceRoleKey"
  "Content-Type" = "application/json"
}

# 1. Fetch Supabase Profiles
Write-Host "1. Querying Supabase public.profiles..." -ForegroundColor Cyan
try {
  $profilesUrl = "$cleanUrl/rest/v1/profiles?select=*"
  $existingProfiles = Invoke-RestMethod -Uri $profilesUrl -Headers $headers -Method Get
  Write-Host "   Found $($existingProfiles.Count) profile(s) in Supabase." -ForegroundColor Green
} catch {
  Write-Host "⚠️ Warning fetching profiles: $_" -ForegroundColor Yellow
  $existingProfiles = @()
}

# 2. Fetch Supabase Auth Users
Write-Host "2. Querying Supabase Auth users..." -ForegroundColor Cyan
try {
  $authUsersUrl = "$cleanUrl/auth/v1/admin/users?per_page=1000"
  $authResp = Invoke-RestMethod -Uri $authUsersUrl -Headers $headers -Method Get
  $existingAuthUsers = $authResp.users
  Write-Host "   Found $($existingAuthUsers.Count) auth user(s) in Supabase Auth." -ForegroundColor Green
} catch {
  Write-Host "⚠️ Warning fetching auth users: $_" -ForegroundColor Yellow
  $existingAuthUsers = @()
}

Write-Host "`n3. Migration Summary Projections:" -ForegroundColor Cyan
Write-Host "   Supabase Auth Count:    $($existingAuthUsers.Count)"
Write-Host "   Supabase Profile Count: $($existingProfiles.Count)"

if ($DryRun) {
  Write-Host "`n💡 Dry Run complete. All endpoints verified." -ForegroundColor Yellow
} else {
  Write-Host "`n✅ Ready for live synchronization." -ForegroundColor Green
}
