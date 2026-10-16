class UserModel {
  final int id;
  final String name;
  final String email;
  final String? nik;
  final String? company; // 'rbs' or 'rimamandiri'
  final String role; // 'admin', 'super_admin', 'user', 'viewer'
  final String? position;
  final String? department;
  final String? schoolUnit;
  final String? phone;
  final String? avatarUrl;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    this.nik,
    this.company,
    required this.role,
    this.position,
    this.department,
    this.schoolUnit,
    this.phone,
    this.avatarUrl,
  });

  bool get isRbs => (company?.toLowerCase() == 'rbs' || company?.toLowerCase() == 'rimbun');
  bool get isRiama => (company?.toLowerCase() == 'rimamandiri' || company?.toLowerCase() == 'riama');
  bool get isAdmin => (role == 'admin' || role == 'super_admin');

  String get companyDisplayName {
    if (isRiama) return 'PT. Riama Mandiri Pratama';
    return 'PT. Rimbun Buana Sejahtera';
  }

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      nik: json['nik']?.toString(),
      company: json['company']?.toString(),
      role: json['role']?.toString() ?? 'user',
      position: json['position']?.toString(),
      department: json['department']?.toString(),
      schoolUnit: json['school_unit']?.toString() ?? json['unit_sekolah']?.toString(),
      phone: json['phone']?.toString(),
      avatarUrl: json['avatar_url']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'nik': nik,
      'company': company,
      'role': role,
      'position': position,
      'department': department,
      'phone': phone,
      'avatar_url': avatarUrl,
    };
  }
}
