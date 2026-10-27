<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ImageCompressionService
{
    /**
     * Kompres dan resize UploadedFile lalu simpan ke storage public.
     * Mengurangi dimensi foto kamera HP (misal 4000x3000px) menjadi maks 1280px
     * dan mengompres ke JPEG berkualitas 75%.
     * Hasil: Ukuran file 3-8 MB berkurang menjadi ~150-250 KB (hemat 90%+ ruang disk).
     *
     * @param UploadedFile $file File yang diunggah
     * @param string $folder Folder penyimpanan (contoh: 'work_reports', 'complaints')
     * @param int $maxDimension Batas maksimum panjang/lebar dalam pixel (default: 1280)
     * @param int $quality Kualitas JPEG 1-100 (default: 75)
     * @return string Relative path file yang tersimpan (misal: 'work_reports/xxx.jpg')
     */
    public static function compressAndStore(
        UploadedFile $file,
        string $folder = 'work_reports',
        int $maxDimension = 1280,
        int $quality = 75
    ): string {
        $cleanFolder = trim($folder, '/');
        $filename = Str::random(40) . '.jpg';
        $targetRelativePath = $cleanFolder . '/' . $filename;

        // Jika file berupa dokumen PDF atau bukan gambar, simpan langsung tanpa kompresi
        $mime = $file->getMimeType() ?: '';
        if (!str_starts_with($mime, 'image/')) {
            return $file->store($cleanFolder, 'public');
        }

        // Jika ekstensi GD tidak tersedia, fallback simpan apa adanya
        if (!extension_loaded('gd')) {
            return $file->store($cleanFolder, 'public');
        }

        try {
            $sourcePath = $file->getRealPath();
            $imageInfo = @getimagesize($sourcePath);
            $detectedMime = $imageInfo['mime'] ?? $mime;

            $image = match ($detectedMime) {
                'image/jpeg', 'image/jpg' => @imagecreatefromjpeg($sourcePath),
                'image/png' => @imagecreatefrompng($sourcePath),
                'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($sourcePath) : null,
                default => @imagecreatefromstring((string) file_get_contents($sourcePath)),
            };

            if (!$image) {
                return $file->store($cleanFolder, 'public');
            }

            // Normalisasi orientasi EXIF (foto HP portrait / landscape)
            if (function_exists('exif_read_data')) {
                $exif = @exif_read_data($sourcePath);
                if (!empty($exif['Orientation'])) {
                    $image = match ((int) $exif['Orientation']) {
                        3 => imagerotate($image, 180, 0),
                        6 => imagerotate($image, -90, 0),
                        8 => imagerotate($image, 90, 0),
                        default => $image,
                    };
                }
            }

            // Resize jika dimensi melebihi $maxDimension
            $origWidth = imagesx($image);
            $origHeight = imagesy($image);

            if ($origWidth > $maxDimension || $origHeight > $maxDimension) {
                if ($origWidth >= $origHeight) {
                    $newWidth = $maxDimension;
                    $newHeight = (int) round(($origHeight / $origWidth) * $maxDimension);
                } else {
                    $newHeight = $maxDimension;
                    $newWidth = (int) round(($origWidth / $origHeight) * $maxDimension);
                }

                $resized = imagescale($image, $newWidth, $newHeight, IMG_BILINEAR_FIXED);
                if ($resized !== false) {
                    imagedestroy($image);
                    $image = $resized;
                }
            }

            // Konversi ke JPEG dengan kualitas teroptimasi
            ob_start();
            imagejpeg($image, null, $quality);
            $compressedData = ob_get_clean();
            imagedestroy($image);

            if (!empty($compressedData)) {
                Storage::disk('public')->put($targetRelativePath, $compressedData);
                return $targetRelativePath;
            }
        } catch (\Throwable $e) {
            // Fallback aman ke penyimpanan bawaan Laravel
        }

        return $file->store($cleanFolder, 'public');
    }
}
