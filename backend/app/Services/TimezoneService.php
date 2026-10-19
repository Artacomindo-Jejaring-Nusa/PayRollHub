<?php

namespace App\Services;

use App\Models\User;
use App\Models\Payroll;
use App\Models\AttendanceLocation;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class TimezoneService
{
    /**
     * Kata kunci provinsi, kota, dan kabupaten resmi untuk WIT (UTC+9).
     */
    private const WIT_TERMS = [
        'PAPUA', 'JAYAPURA', 'MERAUKE', 'TIMIKA', 'MIMIKA', 'SORONG', 'MANOKWARI',
        'WAMENA', 'BIAK', 'NABIRE', 'SARMI', 'MALUKU', 'AMBON', 'TERNATE', 'TIDORE',
        'HALMAHERA', 'SERAM', 'BURU', 'KEI', 'ARU', 'TANIMBAR'
    ];

    /**
     * Kata kunci provinsi, kota, dan kabupaten resmi untuk WITA (UTC+8).
     */
    private const WITA_TERMS = [
        'BALI', 'DENPASAR', 'BADUNG', 'BULELENG', 'GIANYAR', 'TABANAN', 'KLUNGKUNG', 'BANGLI', 'KARANGASEM', 'JEMBRANA',
        'NUSA TENGGARA BARAT', 'NTB', 'LOMBOK', 'MATARAM', 'BIMA', 'SUMBAWA', 'DOMPU',
        'NUSA TENGGARA TIMUR', 'NTT', 'KUPANG', 'FLORES', 'SUMBA', 'TIMOR', 'ALOR', 'ENDE', 'MANGGARAI', 'ROTE',
        'KALIMANTAN SELATAN', 'KALSEL', 'BANJARMASIN', 'BANJARBARU', 'BANJAR', 'TABALONG', 'KOTABARU', 'TANAH LAUT', 'TANAH BUMBU', 'HULU SUNGAI', 'BARITO KUALA', 'TAPIN', 'BALANGAN',
        'KALIMANTAN TIMUR', 'KALTIM', 'SAMARINDA', 'BALIKPAPAN', 'KUTAI', 'BERAU', 'PASER', 'BONTANG', 'MAHAKAM',
        'KALIMANTAN UTARA', 'KALTARA', 'TARAKAN', 'NUNUKAN', 'BULUNGAN', 'MALINAU', 'TANA TIDUNG',
        'SULAWESI UTARA', 'SULUT', 'MANADO', 'BITUNG', 'TOMOHON', 'MINAHASA', 'KOTAMOBAGU', 'BOLAANG', 'SANGIHE', 'TALAUD', 'SIAU',
        'GORONTALO', 'BOALEMO', 'BONE BOLANGO', 'POHUWATO',
        'SULAWESI TENGAH', 'SULTENG', 'PALU', 'POSO', 'DONGGALA', 'TOLITOLI', 'BANGGAI', 'MOROWALI', 'PARIGI', 'BUOL', 'TOJO UNA-UNA',
        'SULAWESI BARAT', 'SULBAR', 'MAMUJU', 'POLEWALI', 'MANDAR', 'MAJENE', 'MAMASA', 'PASANGKAYU',
        'SULAWESI SELATAN', 'SULSEL', 'MAKASSAR', 'GOWA', 'MAROS', 'BARRU', 'SOPPENG', 'PANGKAJENE', 'BONE', 'WAJO', 'BULUKUMBA', 'SINJAI', 'PALOPO', 'LUWU', 'TORAJA', 'SIDENRENG', 'RAPPANG', 'PINRANG', 'ENREKANG', 'SELAYAR', 'TAKALAR', 'JENEPONTO', 'BANTAENG',
        'SULAWESI TENGGARA', 'SULTRA', 'KENDARI', 'KOLAKA', 'BAUBAU', 'MUNA', 'BUTON', 'KONAWE', 'BOMBANA', 'WAKATOBI'
    ];

    /**
     * Kata kunci provinsi, kota, dan kabupaten resmi untuk WIB (UTC+7).
     */
    private const WIB_TERMS = [
        'ACEH', 'LHOKSEUMAWE', 'BANDA ACEH', 'LANGSA', 'SABANG', 'SUBULUSSALAM', 'BIREUEN', 'PIDIE', 'ACEH BESAR', 'ACEH UTARA', 'ACEH TIMUR', 'ACEH BARAT', 'ACEH SELATAN', 'ACEH TENGAH', 'ACEH SINGKIL', 'ACEH TAMIANG', 'ACEH JAYA', 'NAGAN RAYA', 'GAYO LUES', 'BENER MERIAH',
        'SUMATERA UTARA', 'SUMUT', 'MEDAN', 'DELI SERDANG', 'ASAHAN', 'BINJAI', 'TEBING TINGGI', 'PEMATANGSIANTAR', 'KARO', 'LANGKAT', 'SIMALUNGUN', 'TOBA', 'TAPANULI', 'LABUHANBATU', 'DAIRI', 'NIAS',
        'SUMATERA BARAT', 'SUMBAR', 'PADANG', 'BUKITTINGGI', 'PARIAMAN', 'PAYAKUMBUH', 'SOLOK', 'AGAM', 'PASAMAN', 'PESISIR SELATAN', 'TANAH DATAR', 'SIJUNJUNG', 'DHARMASRAYA',
        'RIAU', 'PEKANBARU', 'DUMAI', 'ROKAN', 'KUANTAN', 'INDRAGIRI', 'KAMPAR', 'PELALAWAN', 'SIAK', 'BENGKALIS', 'MERANTI',
        'KEPULAUAN RIAU', 'KEPRI', 'BATAM', 'BINTAN', 'TANJUNGPINANG', 'KARIMUN', 'NATUNA', 'ANAMBAS', 'LINGGA',
        'JAMBI', 'MUARO JAMBI', 'BUNGGO', 'BATANGHARI', 'SAROLANGUN', 'MERANGIN', 'KERINCI', 'SUNGAI PENUH', 'TEBO', 'TANJUNG JABUNG',
        'SUMATERA SELATAN', 'SUMSEL', 'PALEMBANG', 'OGAN', 'LAHAT', 'LUBUKLINGGAU', 'PRABUMULIH', 'PAGAR ALAM', 'BANYUASIN', 'MUSI', 'EMPAT LAWANG', 'MUARA ENIM',
        'BANGKA', 'BELITUNG', 'BABEL', 'PANGKALPINANG',
        'BENGKULU', 'REJANG LEBONG', 'MUKOMUKO', 'SELUMA', 'KAUR',
        'LAMPUNG', 'BANDAR LAMPUNG', 'METRO', 'TULANG BAWANG', 'WAY KANAN', 'PRINGSEWU', 'PESAWARAN', 'TANGGAMUS',
        'DKI JAKARTA', 'JAKARTA',
        'BANTEN', 'TANGERANG', 'SERANG', 'CILEGON', 'LEBAK', 'PANDEGLANG',
        'JAWA BARAT', 'JABAR', 'BANDUNG', 'BOGOR', 'BEKASI', 'DEPOK', 'CIREBON', 'SUKABUMI', 'TASIKMALAYA', 'GARUT', 'MAJALENGKA', 'SUBANG', 'PURWAKARTA', 'KARAWANG', 'KUNINGAN', 'INDRAMAYU', 'CIAMIS', 'PANGANDARAN',
        'JAWA TENGAH', 'JATENG', 'SEMARANG', 'SOLO', 'SURAKARTA', 'BANYUMAS', 'CILACAP', 'MAGELANG', 'WONOSOBO', 'PURWOREJO', 'KEBUMEN', 'BOYOLALI', 'KLATEN', 'SUKOHARJO', 'KARANGANYAR', 'SRAGEN', 'GROBOGAN', 'BLORA', 'REMBANG', 'PATI', 'KUDUS', 'JEPARA', 'DEMAK', 'TEMANGGUNG', 'KENDAL', 'BATANG', 'PEKALONGAN', 'PEMALANG', 'TEGAL', 'BREBES',
        'DAERAH ISTIMEWA YOGYAKARTA', 'YOGYAKARTA', 'DIY', 'SLEMAN', 'BANTUL', 'KULON PROGO', 'GUNUNGKIDUL',
        'JAWA TIMUR', 'JATIM', 'SURABAYA', 'MALANG', 'SIDOARJO', 'GRESIK', 'KEDIRI', 'JEMBER', 'BANYUWANGI', 'PASURUAN', 'MOJOKERTO', 'MADIUN', 'BLITAR', 'PROBOLINGGO', 'BOJONEGORO', 'LAMONGAN', 'TUBAN', 'NGAWI', 'MAGETAN', 'PONOROGO', 'PACITAN', 'TRENGGALEK', 'TULUNGAGUNG', 'LUMAJANG', 'BONDOWOSO', 'SITUBONDO', 'BANGKALAN', 'SAMPANG', 'PAMEKASAN', 'SUMENEP',
        'KALIMANTAN BARAT', 'KALBAR', 'PONTIANAK', 'SINGKAWANG', 'KETAPANG', 'SAMBAS', 'BENGKAYANG', 'LANDAK', 'SANGGAU', 'SEKADAU', 'SINTANG', 'KAPUAS HULU', 'KUBU RAYA', 'KAYONG UTARA',
        'KALIMANTAN TENGAH', 'KALTENG', 'PALANGKA RAYA', 'KOTAWARINGIN', 'KATINGAN', 'SERUYAN', 'SUKAMARA', 'LAMANDAU', 'GUNUNG MAS', 'PULANG PISAU', 'MURUNG RAYA', 'BARITO'
    ];

    /**
     * Dapatkan informasi zona waktu (WIB, WITA, atau WIT) untuk user/karyawan.
     * Menggunakan strategi Hybrid Multi-Layer:
     * 1. Header/Request Timezone (jika client mengirimkan timezone eksplisit yang valid)
     * 2. Pemetaan Provinsi Resmi Penugasan Sekolah (Scoped by NIK / School Unit)
     * 3. Pemetaan Nama Unit Sekolah / Nama Lokasi via Kamus Wilayah Indonesia
     * 4. Validasi Geografis Bujur/Longitude (Sumatera/Jawa/Kalbar mutlak WIB; Maluku/Papua mutlak WIT)
     * 5. Resolusi Koordinat TimeAPI.io (dengan cache)
     * 6. Default: WIB (Asia/Jakarta)
     */
    public static function resolveUserTimezone(
        User $user, 
        ?float $clientLat = null, 
        ?float $clientLng = null, 
        ?string $clientTz = null
    ): array {
        // 1. Cek parameter atau header spesifik dari client (misal: "WIT", "WITA", "Asia/Jayapura")
        if (!empty($clientTz)) {
            $parsed = self::parseTimezoneString($clientTz);
            if ($parsed) {
                return $parsed;
            }
        }

        $loc = null;
        if ($user->attendance_location_id) {
            $loc = AttendanceLocation::find($user->attendance_location_id);
        }

        // Cek koordinat bujur (longitude) riil (baik dari GPS client saat absen atau koordinat lokasi sekolah)
        // Koordinat placeholder default kantor pusat (~107.0256) diabaikan agar tidak salah menandai unit luar Jawa
        $realLng = null;
        $realLat = null;
        if ($clientLng !== null && $clientLng > 0 && abs($clientLng - 107.0256) >= 0.05) {
            $realLng = $clientLng;
            $realLat = $clientLat;
        } elseif ($loc && $loc->longitude && abs((float)$loc->longitude - 107.0256) >= 0.05) {
            $realLng = (float)$loc->longitude;
            $realLat = (float)$loc->latitude;
        }

        // 2. Cek provinsi penugasan resmi dari Payroll (dengan scoping ketat NIK / school_unit)
        $province = self::resolveUserProvince($user, $loc);
        if ($province) {
            $parsedFromProv = self::resolveFromText($province);
            if ($parsedFromProv) {
                // Sanity check koordinat fisik riil:
                // Jika koordinat fisik riil berada di < 114° (Sumatera/Jawa/Kalbar/Kalteng), tidak mungkin WITA/WIT
                if ($realLng !== null) {
                    if ($realLng < 114.0 && $parsedFromProv['code'] !== 'WIB') {
                        return self::formatResult('WIB', 'Asia/Jakarta', '+07:00', 'Zona Waktu Indonesia Barat (WIB)');
                    }
                    if ($realLng > 125.0 && $parsedFromProv['code'] !== 'WIT') {
                        return self::formatResult('WIT', 'Asia/Jayapura', '+09:00', 'Zona Waktu Indonesia Timur (WIT)');
                    }
                }
                return $parsedFromProv;
            }
        }

        // 3. Cek dari nama unit sekolah atau nama lokasi via kata kunci kota/kabupaten
        $keywordMatch = self::resolveFromText(($user->school_unit ?? '') . ' ' . ($loc ? $loc->name : ''));
        if ($keywordMatch) {
            if ($realLng !== null) {
                if ($realLng < 114.0 && $keywordMatch['code'] !== 'WIB') {
                    return self::formatResult('WIB', 'Asia/Jakarta', '+07:00', 'Zona Waktu Indonesia Barat (WIB)');
                }
                if ($realLng > 125.0 && $keywordMatch['code'] !== 'WIT') {
                    return self::formatResult('WIT', 'Asia/Jayapura', '+09:00', 'Zona Waktu Indonesia Timur (WIT)');
                }
            }
            return $keywordMatch;
        }

        // 4. Jika ada koordinat bujur riil, tentukan dari batas bujur Indonesia
        if ($realLng !== null) {
            if ($realLng >= 125.0) {
                return self::formatResult('WIT', 'Asia/Jayapura', '+09:00', 'Zona Waktu Indonesia Timur (WIT)');
            } elseif ($realLng >= 115.0) {
                return self::formatResult('WITA', 'Asia/Makassar', '+08:00', 'Zona Waktu Indonesia Tengah (WITA)');
            } else {
                return self::formatResult('WIB', 'Asia/Jakarta', '+07:00', 'Zona Waktu Indonesia Barat (WIB)');
            }
        }

        // 5. Jika ada koordinat dan ingin resolusi via TimeAPI.io
        $queryLat = $clientLat ?: ($loc ? (float)$loc->latitude : null);
        $queryLng = $clientLng ?: ($loc ? (float)$loc->longitude : null);
        if ($queryLat !== null && $queryLng !== null && $queryLng > 0) {
            $parsedFromCoord = self::resolveFromCoordinates($queryLat, $queryLng);
            if ($parsedFromCoord) {
                return $parsedFromCoord;
            }
        }

        // 6. Default: WIB (Waktu Indonesia Barat)
        return self::formatResult('WIB', 'Asia/Jakarta', '+07:00', 'Zona Waktu Indonesia Barat (WIB)');
    }

    /**
     * Dapatkan Carbon instance dan rincian waktu server saat ini sesuai zona waktu user.
     */
    public static function getNowForUser(
        User $user, 
        ?float $clientLat = null, 
        ?float $clientLng = null, 
        ?string $clientTz = null
    ): array {
        $tz = self::resolveUserTimezone($user, $clientLat, $clientLng, $clientTz);
        $carbon = Carbon::now($tz['iana']);

        return [
            'carbon' => $carbon,
            'today' => $carbon->toDateString(),
            'time' => $carbon->format('H:i:s'),
            'time_short' => $carbon->format('H:i'),
            'formatted' => $carbon->format('H:i:s') . ' ' . $tz['code'],
            'timezone' => $tz['code'],
            'timezone_name' => $tz['iana'],
            'timezone_label' => $tz['label'],
            'timezone_offset' => $tz['offset'],
        ];
    }

    /**
     * Resolusi via koordinat (menggunakan TimeAPI.io dengan cache, atau fallback batas bujur).
     */
    public static function resolveFromCoordinates(float $lat, float $lng): array
    {
        $cacheKey = 'tz_coord_' . round($lat, 2) . '_' . round($lng, 2);

        $resolved = Cache::remember($cacheKey, 86400 * 30, function () use ($lat, $lng) {
            try {
                $response = Http::timeout(1.5)->get('https://timeapi.io/api/timezone/coordinate', [
                    'latitude' => $lat,
                    'longitude' => $lng,
                ]);

                if ($response->successful()) {
                    $iana = $response->json('timeZone');
                    if ($iana) {
                        return $iana;
                    }
                }
            } catch (\Throwable $e) {
                // Abaikan jika network TimeAPI lambat/down, fallback ke bujur geografis
            }

            if ($lng >= 125.0) {
                return 'Asia/Jayapura';
            } elseif ($lng >= 115.0) {
                return 'Asia/Makassar';
            } else {
                return 'Asia/Jakarta';
            }
        });

        return self::parseTimezoneString($resolved ?: 'Asia/Jakarta')
            ?: self::formatResult('WIB', 'Asia/Jakarta', '+07:00', 'Zona Waktu Indonesia Barat (WIB)');
    }

    /**
     * Cari nama provinsi user dari tabel payrolls dengan scoping ketat (NIK / school_unit).
     */
    public static function resolveUserProvince(User $user, ?AttendanceLocation $loc = null): ?string
    {
        $company = $user->company ?: 'rbs';

        // 1. Cek langsung dari payroll berdasarkan NIK yang valid
        if (!empty($user->nik) && strlen(trim($user->nik)) >= 6 && trim($user->nik) !== '_') {
            $p = Payroll::where('company', $company)
                ->where('nik', trim($user->nik))
                ->whereNotNull('province')
                ->where('province', '!=', '')
                ->first();
            if ($p && !empty($p->province)) {
                return $p->province;
            }
        }

        // 2. Cek berdasarkan Nama Karyawan DAN Unit Sekolah (agar tidak tertukar dengan nama orang lain di provinsi berbeda)
        if (!empty($user->school_unit)) {
            $p = Payroll::where('company', $company)
                ->where('employee_name', $user->name)
                ->where('school_unit', $user->school_unit)
                ->whereNotNull('province')
                ->where('province', '!=', '')
                ->first();
            if ($p && !empty($p->province)) {
                return $p->province;
            }

            // 3. Cek dari nama unit sekolah (karena 1 unit sekolah pasti berada di 1 provinsi)
            $pUnit = Payroll::where('company', $company)
                ->where('school_unit', $user->school_unit)
                ->whereNotNull('province')
                ->where('province', '!=', '')
                ->first();
            if ($pUnit && !empty($pUnit->province)) {
                return $pUnit->province;
            }
        }

        // 4. Cek dari nama AttendanceLocation jika terpasang
        if ($loc && !empty($loc->name)) {
            $pLoc = Payroll::where('company', $company)
                ->where('school_unit', $loc->name)
                ->whereNotNull('province')
                ->where('province', '!=', '')
                ->first();
            if ($pLoc && !empty($pLoc->province)) {
                return $pLoc->province;
            }
        }

        return null;
    }

    /**
     * Resolusi teks provinsi / nama daerah ke format timezone terstandarisasi.
     */
    public static function resolveFromText(string $text): ?array
    {
        $t = strtoupper(trim($text));
        if (empty($t)) return null;

        foreach (self::WIT_TERMS as $term) {
            if (str_contains($t, $term)) {
                return self::formatResult('WIT', 'Asia/Jayapura', '+09:00', 'Zona Waktu Indonesia Timur (WIT)');
            }
        }

        foreach (self::WITA_TERMS as $term) {
            if (str_contains($t, $term)) {
                return self::formatResult('WITA', 'Asia/Makassar', '+08:00', 'Zona Waktu Indonesia Tengah (WITA)');
            }
        }

        foreach (self::WIB_TERMS as $term) {
            if (str_contains($t, $term)) {
                return self::formatResult('WIB', 'Asia/Jakarta', '+07:00', 'Zona Waktu Indonesia Barat (WIB)');
            }
        }

        return null;
    }

    /**
     * Alias backward-compatible untuk resolveFromProvince
     */
    public static function resolveFromProvince(string $province): ?array
    {
        return self::resolveFromText($province) ?: self::formatResult('WIB', 'Asia/Jakarta', '+07:00', 'Zona Waktu Indonesia Barat (WIB)');
    }

    private static function parseTimezoneString(string $tz): ?array
    {
        $upper = strtoupper(trim($tz));
        if ($upper === 'WIT' || str_contains($upper, 'JAYAPURA')) {
            return self::formatResult('WIT', 'Asia/Jayapura', '+09:00', 'Zona Waktu Indonesia Timur (WIT)');
        }
        if ($upper === 'WITA' || str_contains($upper, 'MAKASSAR') || str_contains($upper, 'UJUNG_PANDANG')) {
            return self::formatResult('WITA', 'Asia/Makassar', '+08:00', 'Zona Waktu Indonesia Tengah (WITA)');
        }
        if ($upper === 'WIB' || str_contains($upper, 'JAKARTA')) {
            return self::formatResult('WIB', 'Asia/Jakarta', '+07:00', 'Zona Waktu Indonesia Barat (WIB)');
        }
        return null;
    }

    private static function formatResult(string $code, string $iana, string $offset, string $label): array
    {
        return [
            'code' => $code,
            'iana' => $iana,
            'offset' => $offset,
            'label' => $label,
        ];
    }
}
