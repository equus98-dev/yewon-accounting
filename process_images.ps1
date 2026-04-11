Add-Type -AssemblyName System.Drawing
$imgDir = "f:\2. 업무폴더\4_예원예술대학교\Accounting system\img"
$files = @("sign_이수영.png", "sign_이명근.png", "sign_송소라.png")

foreach ($file in $files) {
    $path = Join-Path $imgDir $file
    if (Test-Path $path) {
        $bmp = [System.Drawing.Bitmap]::FromFile($path)
        $newBmp = New-Object System.Drawing.Bitmap $bmp.Width, $bmp.Height
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            for ($y = 0; $y -lt $bmp.Height; $y++) {
                $pixel = $bmp.GetPixel($x, $y)
                $brightness = ($pixel.R * 0.3 + $pixel.G * 0.59 + $pixel.B * 0.11)
                $alpha = 255 - [int]$brightness
                $alpha = [int]($alpha * 1.5)
                if ($alpha -gt 255) { $alpha = 255 }
                if ($alpha -lt 30) { $alpha = 0 }
                
                $newBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 0, 0, 0))
            }
        }
        $bmp.Dispose()
        $newPath = Join-Path $imgDir ("tmp_" + $file)
        $newBmp.Save($newPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $newBmp.Dispose()
        Move-Item $newPath $path -Force
        Write-Host "Processed $file"
    } else {
        Write-Host "File not found: $file"
    }
}
