<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Complaint;
use App\Models\FcmDeviceToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationFeatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_remove_fcm_token(): void
    {
        $user = User::factory()->create(['role' => 'karyawan']);

        // 1. Register Token
        $response = $this->actingAs($user, 'sanctum')->postJson('/api/fcm-token', [
            'token' => 'mock_fcm_token_1234567890',
            'platform' => 'android',
            'device_name' => 'Samsung S23',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseHas('fcm_device_tokens', [
            'user_id' => $user->id,
            'token' => 'mock_fcm_token_1234567890',
            'platform' => 'android',
        ]);

        // 2. Remove Token on Logout
        $deleteResponse = $this->actingAs($user, 'sanctum')->deleteJson('/api/fcm-token', [
            'token' => 'mock_fcm_token_1234567890',
        ]);

        $deleteResponse->assertStatus(200);
        $this->assertDatabaseMissing('fcm_device_tokens', [
            'token' => 'mock_fcm_token_1234567890',
        ]);
    }

    public function test_admin_is_notified_when_employee_submits_complaint_or_feedback(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'company' => 'rbs',
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
            'name' => 'Budi Santoso',
            'school_unit' => 'RBS Pusat',
        ]);

        // Employee submits complaint
        $response = $this->actingAs($employee, 'sanctum')->postJson('/api/employee/complaints', [
            'title' => 'AC Ruang Guru Rusak',
            'category' => 'fasilitas',
            'description' => 'Mohon diperbaiki AC di ruang guru lantai 2.',
        ]);

        $response->assertStatus(201);

        // Verify AppNotification is created for Admin
        $this->assertDatabaseHas('app_notifications', [
            'user_id' => $admin->id,
            'type' => 'admin_new_complaint',
        ]);

        // Admin checks notifications endpoint
        $notifResponse = $this->actingAs($admin, 'sanctum')->getJson('/api/notifications');
        $notifResponse->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('meta.unread_count', 1);
    }

    public function test_employee_is_notified_when_admin_updates_complaint_status(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'company' => 'rbs',
        ]);

        $employee = User::factory()->create([
            'role' => 'karyawan',
            'company' => 'rbs',
        ]);

        $complaint = Complaint::create([
            'ticket_number' => 'KLH-20261020-001-ABCD',
            'user_id' => $employee->id,
            'company' => 'rbs',
            'school_unit' => 'RBS Pusat',
            'title' => 'Masalah Komputer',
            'category' => 'teknis',
            'description' => 'Komputer mati total.',
            'status' => 'pending',
        ]);

        // Admin updates status to resolved
        $updateResponse = $this->actingAs($admin, 'sanctum')->putJson("/api/admin/complaints/{$complaint->id}", [
            'status' => 'resolved',
            'admin_notes' => 'Sudah diganti power supply baru.',
        ]);

        $updateResponse->assertStatus(200);

        // Verify AppNotification created for Employee
        $this->assertDatabaseHas('app_notifications', [
            'user_id' => $employee->id,
            'type' => 'complaint_resolved',
        ]);

        // Employee checks notifications endpoint
        $notifResponse = $this->actingAs($employee, 'sanctum')->getJson('/api/notifications');
        $notifResponse->assertStatus(200)
            ->assertJsonPath('meta.unread_count', 1);

        $notificationId = $notifResponse->json('data.0.id');

        // Mark as read
        $readResponse = $this->actingAs($employee, 'sanctum')->postJson("/api/notifications/{$notificationId}/read");
        $readResponse->assertStatus(200);

        $this->assertDatabaseHas('app_notifications', [
            'id' => $notificationId,
            'is_read' => true,
        ]);
    }
}
