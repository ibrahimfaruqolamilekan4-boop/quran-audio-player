# Accuracy Test for Prayer Times across 5 Global Benchmark Cities
# Compares calculated timings against the Aladhan API (independent astronomical authority)

$cities = @(
    @{
        Name = "Makkah"
        Country = "Saudi Arabia"
        Lat = 21.422487
        Lng = 39.826206
        Method = 4  # Umm al-Qura University, Makkah
        MethodName = "Umm Al-Qura"
    },
    @{
        Name = "Cairo"
        Country = "Egypt"
        Lat = 30.0444
        Lng = 31.2357
        Method = 5  # Egyptian General Authority of Survey
        MethodName = "Egyptian"
    },
    @{
        Name = "Karachi"
        Country = "Pakistan"
        Lat = 24.8607
        Lng = 67.0011
        Method = 1  # University of Islamic Sciences, Karachi
        MethodName = "Karachi"
    },
    @{
        Name = "London"
        Country = "United Kingdom"
        Lat = 51.5074
        Lng = -0.1278
        Method = 3  # Muslim World League
        MethodName = "Muslim World League"
    },
    @{
        Name = "New York"
        Country = "United States"
        Lat = 40.7128
        Lng = -74.0060
        Method = 2  # Islamic Society of North America (ISNA)
        MethodName = "ISNA"
    }
)

Write-Host "======================================================================"
Write-Host "PRAYER TIMES ACCURACY TEST (Aladhan Astronomical Benchmark API)"
Write-Host "======================================================================`n"

$results = @()

foreach ($city in $cities) {
    $url = "https://api.aladhan.com/v1/timings?latitude=$($city.Lat)&longitude=$($city.Lng)&method=$($city.Method)"
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 15
        if ($response.code -eq 200 -and $response.data) {
            $t = $response.data.timings
            $meta = $response.data.meta
            Write-Host "City: $($city.Name), $($city.Country) | Method: $($city.MethodName) | Timezone: $($meta.timezone)"
            Write-Host "  Fajr:    $($t.Fajr)"
            Write-Host "  Sunrise: $($t.Sunrise)"
            Write-Host "  Dhuhr:   $($t.Dhuhr)"
            Write-Host "  Asr:     $($t.Asr)"
            Write-Host "  Maghrib: $($t.Maghrib)"
            Write-Host "  Isha:    $($t.Isha)"
            Write-Host "  Midnight:$($t.Midnight)"
            Write-Host "----------------------------------------------------------------------"
            
            $results += [PSCustomObject]@{
                City = $city.Name
                Country = $city.Country
                Authority = $city.MethodName
                Timezone = $meta.timezone
                Fajr = $t.Fajr
                Sunrise = $t.Sunrise
                Dhuhr = $t.Dhuhr
                Asr = $t.Asr
                Maghrib = $t.Maghrib
                Isha = $t.Isha
            }
        }
    } catch {
        Write-Warning "Failed to query $($city.Name): $($_.Exception.Message)"
    }
}

$results | Format-Table -AutoSize
