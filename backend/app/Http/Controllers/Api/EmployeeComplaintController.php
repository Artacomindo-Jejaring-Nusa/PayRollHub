<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Complaint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeComplaintController extends Controller
{
    /**
     * Display listing of complaints submitted by the authenticated employee.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $status = $request->query('status');

        $query = Complaint::where('user_id', $user->id)
            ->with(['resolver:id,name'])
            ->latest();

        if ($status && in_array($status, ['pending', 'in_progress', 'resolved', 'rejected'])) {
            $query->where('status', $status);
        }

        $complaints = $query->paginate(15);

        return response()->json([
            'status' => 'success',
            'data' => $complaints->items(),
            'meta' => [
                'current_page' => $complaints->currentPage(),
                'last_page' => $complaints->lastPage(),
                'total' => $complaints->total(),
            ],
            'summary' => [
                'total' => Complaint::where('user_id', $user->id)->count(),
                'pending' => Complaint::where('user_id', $user->id)->where('status', 'pending')->count(),
                'in_progress' => Complaint::where('user_id', $user->id)->where('status', 'in_progress')->count(),
                'resolved' => Complaint::where('user_id', $user->id)->where('status', 'resolved')->count(),
            ],
        ]);
    }

    /**
     * Submit a new complaint (Tulisan beserta Foto).
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'category' => ['required', 'string', 'in:gaji,absensi,fasilitas,teknis,lainnya'],
            'description' => ['required', 'string', 'min:5'],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'], // Max 10MB
        ]);

        $photoPath = null;
        $photoName = null;
        if ($request->hasFile('photo')) {
            $file = $request->file('photo');
            $photoPath = $file->store('complaints', 'public');
            $photoName = $file->getClientOriginalName();
        }

        // Generate Ticket Number (contoh: KLH-20261012-001)
        $dateStr = date('Ymd');
        $randomSeq = strtoupper(substr(uniqid(), -4));
        $countToday = Complaint::whereDate('created_at', today())->count() + 1;
        $ticketNumber = sprintf('KLH-%s-%03d-%s', $dateStr, $countToday, $randomSeq);

        $complaint = Complaint::create([
            'ticket_number' => $ticketNumber,
            'user_id' => $user->id,
            'company' => $user->company ?: 'rbs',
            'school_unit' => $user->school_unit,
            'title' => $validated['title'],
            'category' => $validated['category'],
            'description' => $validated['description'],
            'photo_path' => $photoPath,
            'photo_name' => $photoName,
            'status' => 'pending',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Keluhan berhasil dikirimkan ke HRD. Kami akan segera meninjau laporan Anda.',
            'data' => $complaint->load('user:id,name,nik,school_unit'),
        ], 201);
    }

    /**
     * Display detail of a specific complaint for employee.
     */
    public function show(Request $request, Complaint $complaint): JsonResponse
    {
        $user = $request->user();

        if ($complaint->user_id !== $user->id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Akses ditolak. Anda tidak berhak melihat keluhan karyawan lain.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'data' => $complaint->load(['resolver:id,name', 'user:id,name,nik,school_unit']),
        ]);
    }
}
