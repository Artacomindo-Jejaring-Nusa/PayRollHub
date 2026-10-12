<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Create table payroll_periods (Target SP & Periode Custom)
        if (!Schema::hasTable('payroll_periods')) {
            Schema::create('payroll_periods', function (Blueprint $table) {
                $table->id();
                $table->string('code', 50)->index();
                $table->string('name', 150);
                $table->string('company', 50)->default('all')->index();
                $table->boolean('is_sp')->default(true)->index();
                $table->boolean('is_visible_to_user')->default(true)->index();
                $table->text('description')->nullable();
                $table->timestamps();
            });

            // Seed default standard SP 1 - SP 12
            $defaultPeriods = [];
            for ($i = 1; $i <= 12; $i++) {
                $defaultPeriods[] = [
                    'code' => "SP {$i}",
                    'name' => "Surat Pesanan {$i}",
                    'company' => 'all',
                    'is_sp' => true,
                    'is_visible_to_user' => true,
                    'description' => "Periode resmi Surat Pesanan {$i} (SP {$i})",
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            // Seed initial custom periods (Ambon & Cikarang di luar SP, default hidden from user view)
            $defaultPeriods[] = [
                'code' => 'Ambon',
                'name' => 'Wilayah Ambon (Di Luar SP)',
                'company' => 'all',
                'is_sp' => false,
                'is_visible_to_user' => false,
                'description' => 'Target wilayah Ambon untuk karyawan di luar SP (khusus admin)',
                'created_at' => now(),
                'updated_at' => now(),
            ];

            $defaultPeriods[] = [
                'code' => 'Cikarang',
                'name' => 'Wilayah Cikarang (Di Luar SP)',
                'company' => 'all',
                'is_sp' => false,
                'is_visible_to_user' => false,
                'description' => 'Target wilayah Cikarang untuk karyawan di luar SP (khusus admin)',
                'created_at' => now(),
                'updated_at' => now(),
            ];

            DB::table('payroll_periods')->insert($defaultPeriods);
        }

        // 2. Add is_visible_to_user to payrolls table
        if (Schema::hasTable('payrolls') && !Schema::hasColumn('payrolls', 'is_visible_to_user')) {
            Schema::table('payrolls', function (Blueprint $table) {
                $table->boolean('is_visible_to_user')->default(true)->after('period')->index();
            });
        }

        // 3. Add last_login_at and last_login_ip to users table
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (!Schema::hasColumn('users', 'last_login_at')) {
                    $table->timestamp('last_login_at')->nullable()->after('remember_token');
                }
                if (!Schema::hasColumn('users', 'last_login_ip')) {
                    $table->string('last_login_ip', 45)->nullable()->after('last_login_at');
                }
            });

            // Backfill last_login_at from activity_logs if available
            try {
                if (Schema::hasTable('activity_logs')) {
                    $latestLogins = DB::table('activity_logs')
                        ->where('action', 'LOGIN')
                        ->whereNotNull('user_id')
                        ->select('user_id', DB::raw('MAX(created_at) as last_login'), DB::raw('MAX(ip_address) as ip'))
                        ->groupBy('user_id')
                        ->get();

                    foreach ($latestLogins as $item) {
                        DB::table('users')
                            ->where('id', $item->user_id)
                            ->whereNull('last_login_at')
                            ->update([
                                'last_login_at' => $item->last_login,
                                'last_login_ip' => $item->ip,
                            ]);
                    }
                }
            } catch (\Throwable $e) {
                // Ignore backfill errors
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('payrolls') && Schema::hasColumn('payrolls', 'is_visible_to_user')) {
            Schema::table('payrolls', function (Blueprint $table) {
                $table->dropColumn('is_visible_to_user');
            });
        }

        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (Schema::hasColumn('users', 'last_login_ip')) {
                    $table->dropColumn('last_login_ip');
                }
                if (Schema::hasColumn('users', 'last_login_at')) {
                    $table->dropColumn('last_login_at');
                }
            });
        }

        Schema::dropIfExists('payroll_periods');
    }
};
