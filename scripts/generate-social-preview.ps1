param([string]$OutputPath = "")

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$backgroundPath = Join-Path $root "apps/web/public/sky-airplane-background.jpg"
$logoPath = Join-Path $root "changgo-icons/logo.png"
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $root "apps/web/public/social-preview.png"
}

function New-RoundedPath([System.Drawing.RectangleF]$rectangle, [float]$radius) {
  $diameter = $radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($rectangle.X, $rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($rectangle.Right - $diameter, $rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($rectangle.Right - $diameter, $rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($rectangle.X, $rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

$width = 1200
$height = 630
$bitmap = [System.Drawing.Bitmap]::new($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$background = [System.Drawing.Image]::FromFile($backgroundPath)
$logo = [System.Drawing.Image]::FromFile($logoPath)

try {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $sourceWidth = [int]($background.Height * ($width / $height))
  $sourceX = [int](($background.Width - $sourceWidth) / 2)
  $graphics.DrawImage($background, [System.Drawing.Rectangle]::new(0, 0, $width, $height), $sourceX, 0, $sourceWidth, $background.Height, [System.Drawing.GraphicsUnit]::Pixel)

  $overlay = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Rectangle]::new(0, 0, $width, $height), [System.Drawing.Color]::FromArgb(244, 4, 24, 54), [System.Drawing.Color]::FromArgb(168, 0, 91, 184), 0)
  $graphics.FillRectangle($overlay, 0, 0, $width, $height)
  $overlay.Dispose()

  $logoPanel = [System.Drawing.RectangleF]::new(64, 64, 520, 188)
  $logoPanelPath = New-RoundedPath $logoPanel 28
  $logoPanelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(242, 255, 255, 255))
  $graphics.FillPath($logoPanelBrush, $logoPanelPath)
  $graphics.DrawImage($logo, [System.Drawing.RectangleF]::new(92, 92, 464, 132))
  $logoPanelBrush.Dispose()
  $logoPanelPath.Dispose()

  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(226, 236, 248, 255))
  $accent = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 204, 45))
  $headlineFont = [System.Drawing.Font]::new("Malgun Gothic", 40, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $bodyFont = [System.Drawing.Font]::new("Malgun Gothic", 25, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $chipFont = [System.Drawing.Font]::new("Malgun Gothic", 20, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $footerFont = [System.Drawing.Font]::new("Segoe UI", 17, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

  $graphics.DrawString("짐 걱정은 덜고,", $headlineFont, $white, 634, 82)
  $graphics.DrawString("여행은 가볍게.", $headlineFont, $accent, 634, 142)
  $graphics.DrawString("사진으로 물품을 인식하고 항공사 규정으로 판정하는", $bodyFont, $muted, 68, 306)
  $graphics.DrawString("여행 짐 반입 확인 서비스", $bodyFont, $white, 68, 350)

  $chips = @(
    @{ X = 68; Width = 218; Text = "AI 물품 인식" },
    @{ X = 302; Width = 258; Text = "16개 항공사 규정" },
    @{ X = 576; Width = 314; Text = "기내 · 위탁 · 반입 불가" }
  )
  foreach ($chip in $chips) {
    $chipRect = [System.Drawing.RectangleF]::new($chip.X, 438, $chip.Width, 60)
    $chipPath = New-RoundedPath $chipRect 30
    $chipBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(44, 255, 255, 255))
    $graphics.FillPath($chipBrush, $chipPath)
    $textSize = $graphics.MeasureString($chip.Text, $chipFont)
    $graphics.DrawString($chip.Text, $chipFont, $white, $chip.X + (($chip.Width - $textSize.Width) / 2), 438 + ((60 - $textSize.Height) / 2) - 2)
    $chipBrush.Dispose()
    $chipPath.Dispose()
  }

  $linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(72, 255, 255, 255), 1)
  $graphics.DrawLine($linePen, 68, 548, 1132, 548)
  $linePen.Dispose()
  $graphics.DrawString("CWNU SW-DNA² CHALLENGE 2026", $footerFont, $muted, 68, 573)
  $footerText = "He6venly / CWNU_SWDNA9"
  $footerSize = $graphics.MeasureString($footerText, $footerFont)
  $graphics.DrawString($footerText, $footerFont, $muted, 1132 - $footerSize.Width, 573)

  $white.Dispose(); $muted.Dispose(); $accent.Dispose()
  $headlineFont.Dispose(); $bodyFont.Dispose(); $chipFont.Dispose(); $footerFont.Dispose()
  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $logo.Dispose(); $background.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

Write-Output $OutputPath
