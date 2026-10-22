<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\AttendanceLocation;
use App\Models\Shift;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LordAdminFeatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_lord_admin_can_login_using_full_email_and_rimbun_alias(): void
    {
        $lordAdmin = User::create([
            'name' => 'Erika (Owner)',
            'email' => 'erika@rimbunbuanasejahtera.com',
            'password' => Hash::make('password123'),
            'role' => 'lord_admin',
            'company' => 'rbs',
        ]);

        // Login with full email
        $resFull = $this->postJson('/api/login', [
            'identifier' => 'erika@rimbunbuanasejahtera.com',
            'password' => 'password123',
            'company' => 'rbs',
        ]);
        $resFull->assertStatus(200);
        $resFull->assertJsonPath('data.user.role', 'lord_admin');

        // Login with @rimbun alias
        $resAlias = $this->postJson('/api/login', [
            'identifier' => 'erika@rimbun',
            'password' => 'password123',
            'company' => 'rbs',
        ]);
        $resAlias->assertStatus(200);
        $resAlias->assertJsonPath('data.user.role', 'lord_admin');
        $resAlias->assertStatus(200);
        $resAlias->assertJsonPath('data.user.role', 'lord_admin');
    }

    public function test_lord_admin_has_super_admin_privileges(): void
    {
        $lordAdmin = User::create([
            'name' => 'Martin (Owner)',
            'email' => 'martin@rimbunbuanasejahtera.com',
            'password' => Hash::make('password123'),
            'role' => 'lord_admin',
            'company' => 'rbs',
        ]);

        $this->assertTrue($lordAdmin->isAdmin());
        $this->assertTrue($lordAdmin->isSuperAdmin());
        $this->assertTrue($lordAdmin->isLordAdmin());

        // Can access super-admin-only user list
        $response = $this->actingAs($lordAdmin, 'sanctum')->getJson('/api/users');
        $response->assertStatus(200);
    }

    public function test_lord_admin_can_see_super_admin_attendance(): void
    {
        $lordAdmin = User::create([
            'name' => 'Erika (Owner)',
            'email' => 'erika@rimbunbuanasejahtera.com',
            'password' => Hash::make('password123'),
            'role' => 'lord_admin',
            'company' => 'rbs',
        ]);

        $superAdmin = User::create([
            'name' => 'Dewantara',
            'email' => 'dewantara@rimbunbuanasejahtera.com',
            'password' => Hash::make('password123'),
            'role' => 'super_admin',
            'company' => null,
        ]);

        $loc = AttendanceLocation::create([
            'name' => 'Kantor Pusat Operasional',
            'code' => 'HQ-RBS',
            'latitude' => -6.384,
            'longitude' => 107.025,
            'radius_meters' => 100,
            'tenant_id' => 'all',
            'type' => 'headquarters',
            'is_active' => true,
        ]);

        $shift = Shift::create([
            'name' => 'Reguler',
            'code' => 'REG',
            'start_time' => '08:00',
            'end_time' => '17:00',
            'company' => 'all',
            'is_active' => true,
        ]);

        $att = Attendance::create([
            'user_id' => $superAdmin->id,
            'location_id' => $loc->id,
            'shift_id' => $shift->id,
            'attendance_type' => 'masuk',
            'date' => '2026-10-22',
            'check_in_time' => '07:55:00',
            'check_in_lat' => -6.384,
            'check_in_lng' => 107.025,
            'status' => 'present',
            'approval_status' => 'approved',
        ]);

        $response = $this->actingAs($lordAdmin, 'sanctum')->getJson('/api/admin/attendances?date=2026-10-22&role=super_admin&company=rbs');
        $response->assertStatus(200);
        $data = $response->json('data.data');

        $this->assertNotEmpty($data);
        $this->assertEquals($superAdmin->id, $data[0]['user']['id']);
        $this->assertEquals('super_admin', $data[0]['user']['role']);
    }

    public function test_super_admin_cannot_delete_or_demote_lord_admin(): void
    {
        $lordAdmin = User::create([
            'name' => 'Martin (Owner)',
            'email' => 'martin@rimbunbuanasejahtera.com',
            'password' => Hash::make('password123'),
            'role' => 'lord_admin',
            'company' => 'rbs',
        ]);

        $superAdmin = User::create([
            'name' => 'Super Admin Biasa',
            'email' => 'superadmin@example.com',
            'password' => Hash::make('password123'),
            'role' => 'super_admin',
            'company' => null,
        ]);

        // Super Admin tries to delete Lord Admin -> Forbidden 403
        $delRes = $this->actingAs($superAdmin, 'sanctum')->deleteJson("/api/users/{$lordAdmin->id}");
        $delRes->assertStatus(403);

        // Super Admin tries to update Lord Admin -> Forbidden 403
        $updRes = $this->actingAs($superAdmin, 'sanctum')->putJson("/api/users/{$lordAdmin->id}", [
            'name' => 'Hacked',
            'email' => 'martin@rimbunbuanasejahtera.com',
            'role' => 'admin',
        ]);
        $updRes->assertStatus(403);
    }
}
