$port = 8080
$folder = $PSScriptRoot
if (-not $folder) { $folder = "d:\Программы\pintok-apteka" }

# Автоматически находим правильный локальный IP адрес
$allIps = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -notlike "127.*" -and 
    $_.IPAddress -notlike "169.254.*" 
}
# Ищем сеть точки доступа (172.20.10.* или 192.168.*)
$primaryIp = ($allIps | Where-Object { $_.IPAddress -like "172.20.10.*" } | Select-Object -First 1).IPAddress
if (-not $primaryIp) {
    $primaryIp = ($allIps | Where-Object { $_.IPAddress -like "192.168.*" } | Select-Object -First 1).IPAddress
}
if (-not $primaryIp) {
    $primaryIp = ($allIps | Select-Object -First 1).IPAddress
}
if (-not $primaryIp) {
    $primaryIp = "172.20.10.4"
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
try {
    $listener.Start()
} catch {
    Write-Host "Порт $port занят или ошибка запуска: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "   «ПИНТОК МЕДИКАЛ» — МОБИЛЬНЫЙ СЕРВЕР ДЛЯ ТЕЛЕФОНА ЗАПУЩЕН!             " -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📱 САМСУНГ ТЕЛЕФОННАН КИРИЎ УШЫН (Браузерде усы силтемени ашыңыз):" -ForegroundColor White
Write-Host ""
Write-Host "      👉 http://${primaryIp}:${port}/" -ForegroundColor Yellow
Write-Host ""
Write-Host "💻 Компьютерде көриў ушын:  http://localhost:${port}/" -ForegroundColor Gray
Write-Host ""
Write-Host "Телефонда ашылғаннан соң «Установить на телефон» батырмасын басыңыз!" -ForegroundColor White
Write-Host "Серверди жабыў ушын осы айнаны жапсаңыз болады." -ForegroundColor Gray
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host ""

while ($true) {
    try {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        $line = $reader.ReadLine()
        
        if ($line) {
            $tokens = $line.Split(' ')
            if ($tokens.Length -ge 2) {
                $method = $tokens[0]
                $rawUrl = $tokens[1]
                $urlPath = $rawUrl.Split('?')[0].TrimStart('/')
                if ([string]::IsNullOrWhiteSpace($urlPath)) { $urlPath = "index.html" }
                
                $filePath = Join-Path $folder $urlPath

                if (Test-Path $filePath -PathType Leaf) {
                    $bytes = [System.IO.File]::ReadAllBytes($filePath)
                    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                    $contentType = "text/plain"
                    switch ($ext) {
                        ".html" { $contentType = "text/html; charset=utf-8" }
                        ".css"  { $contentType = "text/css; charset=utf-8" }
                        ".js"   { $contentType = "application/javascript; charset=utf-8" }
                        ".json" { $contentType = "application/json; charset=utf-8" }
                        ".jpg"  { $contentType = "image/jpeg" }
                        ".jpeg" { $contentType = "image/jpeg" }
                        ".png"  { $contentType = "image/png" }
                        ".svg"  { $contentType = "image/svg+xml" }
                    }
                    
                    $header = "HTTP/1.1 200 OK`r`n" +
                              "Content-Type: $contentType`r`n" +
                              "Content-Length: $($bytes.Length)`r`n" +
                              "Access-Control-Allow-Origin: *`r`n" +
                              "Connection: close`r`n`r`n"
                    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                    $stream.Write($bytes, 0, $bytes.Length)
                } else {
                    $body = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found: $urlPath")
                    $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
                    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                    $stream.Write($body, 0, $body.Length)
                }
            }
        }
        $stream.Flush()
        $client.Close()
    } catch {
        # ignore client disconnects
    }
}
