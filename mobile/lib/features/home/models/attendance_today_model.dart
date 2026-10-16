class AttendanceLocationModel {
  final int id;
  final String name;
  final String? code;
  final String? address;
  final double latitude;
  final double longitude;
  final int radiusMeters;
  final String? type;

  AttendanceLocationModel({
    required this.id,
    required this.name,
    this.code,
    this.address,
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
    this.type,
  });

  factory AttendanceLocationModel.fromJson(Map<String, dynamic> json) {
    return AttendanceLocationModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name']?.toString() ?? 'Lokasi Kantor',
      code: json['code']?.toString(),
      address: json['address']?.toString(),
      latitude: double.tryParse(json['latitude']?.toString() ?? '0') ?? 0.0,
      longitude: double.tryParse(json['longitude']?.toString() ?? '0') ?? 0.0,
      radiusMeters: int.tryParse(json['radius_meters']?.toString() ?? '100') ?? 100,
      type: json['type']?.toString(),
    );
  }
}

class ShiftModel {
  final int id;
  final String name;
  final String code;
  final String startTime;
  final String endTime;
  final String? formattedTime;

  ShiftModel({
    required this.id,
    required this.name,
    required this.code,
    required this.startTime,
    required this.endTime,
    this.formattedTime,
  });

  factory ShiftModel.fromJson(Map<String, dynamic> json) {
    return ShiftModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name']?.toString() ?? 'Shift Normal',
      code: json['code']?.toString() ?? 'REGULER',
      startTime: json['start_time']?.toString() ?? '08:00',
      endTime: json['end_time']?.toString() ?? '17:00',
      formattedTime: json['formatted_time']?.toString(),
    );
  }
}

class AttendanceRecordModel {
  final int id;
  final String date;
  final String? checkInTime;
  final String? checkOutTime;
  final String? status;
  final String? checkInStatus;
  final String? attendanceType;
  final String? locationName;
  final String? photoUrl;
  final String? notes;
  final String? workDurationFormatted;

  AttendanceRecordModel({
    required this.id,
    required this.date,
    this.checkInTime,
    this.checkOutTime,
    this.status,
    this.checkInStatus,
    this.attendanceType,
    this.locationName,
    this.photoUrl,
    this.notes,
    this.workDurationFormatted,
  });

  factory AttendanceRecordModel.fromJson(Map<String, dynamic> json) {
    return AttendanceRecordModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      date: json['date']?.toString() ?? '',
      checkInTime: json['check_in_time']?.toString(),
      checkOutTime: json['check_out_time']?.toString(),
      status: json['status']?.toString(),
      checkInStatus: json['check_in_status']?.toString(),
      attendanceType: json['attendance_type']?.toString(),
      locationName: json['location_name']?.toString(),
      photoUrl: json['photo_url']?.toString(),
      notes: json['notes']?.toString(),
      workDurationFormatted: json['work_duration_formatted']?.toString(),
    );
  }
}

class TodayAttendanceDataModel {
  final String today;
  final String serverTime;
  final AttendanceRecordModel? attendance;
  final AttendanceLocationModel? assignedLocation;
  final ShiftModel? assignedShift;
  final Map<String, dynamic>? officeSetting;

  TodayAttendanceDataModel({
    required this.today,
    required this.serverTime,
    this.attendance,
    this.assignedLocation,
    this.assignedShift,
    this.officeSetting,
  });

  factory TodayAttendanceDataModel.fromJson(Map<String, dynamic> json) {
    return TodayAttendanceDataModel(
      today: json['today']?.toString() ?? '',
      serverTime: json['server_time']?.toString() ?? '',
      attendance: json['attendance'] != null
          ? AttendanceRecordModel.fromJson(json['attendance'])
          : null,
      assignedLocation: json['assigned_location'] != null
          ? AttendanceLocationModel.fromJson(json['assigned_location'])
          : null,
      assignedShift: json['assigned_shift'] != null
          ? ShiftModel.fromJson(json['assigned_shift'])
          : null,
      officeSetting: json['office_setting'] is Map<String, dynamic>
          ? json['office_setting']
          : null,
    );
  }
}
