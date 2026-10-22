<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\AttendanceLocation;
use App\Models\AttendanceSetting;
use App\Models\Shift;
use App\Models\User;
use App\Models\WorkReport;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportExportFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $employee1;
    protected User $employee2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'company' => 'rbs',
        ]);

        $this->employee1 = User::factory()->create([
            'name' => 'Budi Santoso',
            'nik' => 'EMP001',
            'role' => 'user',
            'company' => 'rbs',
        ]);

        $this->employee2 = User::factory()->create([
            'name' => 'Siti Rahma',
            'nik' => 'EMP002',
            'role' => 'user',
            'company' => 'rbs',
        ]);
    }

    public function test_admin_can_export_work_reports_filtered_by_selected_ids(): void
    {
        $report1 = WorkReport::create([
            'user_id' => $this->employee1->id,
            'nik' => $this->employee1->nik,
            'report_date' => '2026-10-20',
            'title' => 'Laporan 1',
            'description' => 'Deskripsi kegiatan 1',
            'status' => 'approved',
        ]);

        $report2 = WorkReport::create([
            'user_id' => $this->employee2->id,
            'nik' => $this->employee2->nik,
            'report_date' => '2026-10-21',
            'title' => 'Laporan 2',
            'description' => 'Deskripsi kegiatan 2',
            'status' => 'pending',
        ]);

        // Export only report 1 via Excel
        $responseXlsx = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/admin/work-reports/export?format=xlsx&ids=' . $report1->id);

        $responseXlsx->assertStatus(200);
        $this->assertStringContainsString('terpilih_1.xlsx', (string) $responseXlsx->headers->get('content-disposition'));

        // Export only report 1 via PDF
        $responsePdf = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/admin/work-reports/export?format=pdf&ids=' . $report1->id);

        $responsePdf->assertStatus(200);
        $this->assertStringContainsString('terpilih_1.pdf', (string) $responsePdf->headers->get('content-disposition'));
    }

    public function test_admin_can_export_attendances_filtered_by_selected_attendance_ids(): void
    {
        $att1 = Attendance::create([
            'user_id' => $this->employee1->id,
            'date' => '2026-10-20',
            'attendance_type' => 'masuk',
            'status' => 'present',
            'check_in_time' => '08:00:00',
        ]);

        $att2 = Attendance::create([
            'user_id' => $this->employee2->id,
            'date' => '2026-10-20',
            'attendance_type' => 'masuk',
            'status' => 'present',
            'check_in_time' => '08:15:00',
        ]);

        // Export CSV with specific attendance_id
        $response = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/admin/attendances/export?mode=detail&format=csv&attendance_ids=' . $att1->id);

        $response->assertStatus(200);
        $this->assertStringContainsString('terpilih_1', (string) $response->headers->get('content-disposition'));

        // Read streamed CSV output
        ob_start();
        $response->sendContent();
        $content = ob_get_clean();

        $this->assertStringContainsString('Budi Santoso', $content);
        $this->assertStringNotContainsString('Siti Rahma', $content);
    }

    public function test_admin_can_export_employee_recap_filtered_by_user_ids(): void
    {
        Attendance::create([
            'user_id' => $this->employee1->id,
            'date' => '2026-10-20',
            'attendance_type' => 'masuk',
            'status' => 'present',
            'check_in_time' => '08:00:00',
        ]);

        Attendance::create([
            'user_id' => $this->employee2->id,
            'date' => '2026-10-20',
            'attendance_type' => 'masuk',
            'status' => 'present',
            'check_in_time' => '08:15:00',
        ]);

        // Export recap for employee1 only
        $response = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/admin/attendances/export?mode=employee_recap&format=csv&user_ids=' . $this->employee1->id);

        $response->assertStatus(200);

        ob_start();
        $response->sendContent();
        $content = ob_get_clean();

        $this->assertStringContainsString('Budi Santoso', $content);
        $this->assertStringNotContainsString('Siti Rahma', $content);
    }

    public function test_work_report_export_includes_photo_hyperlinks_and_renders_pdf_with_photos(): void
    {
        $report = WorkReport::create([
            'user_id' => $this->employee1->id,
            'nik' => $this->employee1->nik,
            'report_date' => '2026-10-22',
            'title' => 'Laporan Berfoto',
            'desc_absen' => 'Hadir tepat waktu',
            'photo_absen' => 'work_reports/foto_absen_123.jpg',
            'desc_kegiatan1' => 'Mengerjakan instalasi server',
            'photo_kegiatan1' => 'work_reports/foto_keg1_123.jpg',
            'status' => 'approved',
        ]);

        // 1. Test Excel export map contains HYPERLINK
        $export = new \App\Exports\WorkReportExport(new \Illuminate\Http\Request(['ids' => (string) $report->id]));
        $collection = $export->collection();
        $this->assertCount(1, $collection);

        $mapped = $export->map($collection->first());
        // Index 7: 1. FOTO ABSEN
        $this->assertStringContainsString('=HYPERLINK(', $mapped[7]);
        $this->assertStringContainsString('foto_absen_123.jpg', $mapped[7]);
        $this->assertStringContainsString('Lihat Foto', $mapped[7]);

        // Index 9: 2. FOTO KEGIATAN 1
        $this->assertStringContainsString('=HYPERLINK(', $mapped[9]);
        $this->assertStringContainsString('foto_keg1_123.jpg', $mapped[9]);

        // Index 11: 3. FOTO KEGIATAN 2 (Kosong)
        $this->assertEquals('Tidak Ada', $mapped[11]);

        // 2. Test PDF export returns 200 with photos
        $responsePdf = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/admin/work-reports/export?format=pdf&ids=' . $report->id);

        $responsePdf->assertStatus(200);
        $this->assertEquals('application/pdf', $responsePdf->headers->get('content-type'));
    }
}
