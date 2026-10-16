class ComplaintModel {
  final int id;
  final String ticketNumber;
  final int userId;
  final String company;
  final String? schoolUnit;
  final String title;
  final String category;
  final String categoryLabel;
  final String description;
  final String? photoPath;
  final String? photoName;
  final String? photoFullUrl;
  final String status;
  final String statusLabel;
  final String? adminNotes;
  final int? resolvedBy;
  final String? resolverName;
  final DateTime? resolvedAt;
  final DateTime createdAt;

  ComplaintModel({
    required this.id,
    required this.ticketNumber,
    required this.userId,
    required this.company,
    this.schoolUnit,
    required this.title,
    required this.category,
    required this.categoryLabel,
    required this.description,
    this.photoPath,
    this.photoName,
    this.photoFullUrl,
    required this.status,
    required this.statusLabel,
    this.adminNotes,
    this.resolvedBy,
    this.resolverName,
    this.resolvedAt,
    required this.createdAt,
  });

  factory ComplaintModel.fromJson(Map<String, dynamic> json) {
    DateTime? parsedResolvedAt;
    if (json['resolved_at'] != null) {
      try {
        parsedResolvedAt = DateTime.parse(json['resolved_at'].toString());
      } catch (_) {}
    }

    DateTime parsedCreatedAt = DateTime.now();
    if (json['created_at'] != null) {
      try {
        parsedCreatedAt = DateTime.parse(json['created_at'].toString());
      } catch (_) {}
    }

    return ComplaintModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      ticketNumber: json['ticket_number']?.toString() ?? '',
      userId: json['user_id'] is int ? json['user_id'] : int.tryParse(json['user_id']?.toString() ?? '0') ?? 0,
      company: json['company']?.toString() ?? 'rbs',
      schoolUnit: json['school_unit']?.toString(),
      title: json['title']?.toString() ?? '',
      category: json['category']?.toString() ?? 'lainnya',
      categoryLabel: json['category_label']?.toString() ?? (json['category']?.toString() ?? 'Lainnya'),
      description: json['description']?.toString() ?? '',
      photoPath: json['photo_path']?.toString(),
      photoName: json['photo_name']?.toString(),
      photoFullUrl: json['photo_full_url']?.toString(),
      status: json['status']?.toString() ?? 'pending',
      statusLabel: json['status_label']?.toString() ?? 'Menunggu Respon',
      adminNotes: json['admin_notes']?.toString(),
      resolvedBy: json['resolved_by'] is int ? json['resolved_by'] : int.tryParse(json['resolved_by']?.toString() ?? ''),
      resolverName: json['resolver'] is Map ? json['resolver']['name']?.toString() : null,
      resolvedAt: parsedResolvedAt,
      createdAt: parsedCreatedAt,
    );
  }

  bool get isPending => status == 'pending';
  bool get isInProgress => status == 'in_progress';
  bool get isResolved => status == 'resolved';
  bool get isRejected => status == 'rejected';
}

class ComplaintSummaryModel {
  final int total;
  final int pending;
  final int inProgress;
  final int resolved;
  final int rejected;

  ComplaintSummaryModel({
    required this.total,
    required this.pending,
    required this.inProgress,
    required this.resolved,
    this.rejected = 0,
  });

  factory ComplaintSummaryModel.fromJson(Map<String, dynamic> json) {
    return ComplaintSummaryModel(
      total: json['total'] is int ? json['total'] : int.tryParse(json['total']?.toString() ?? '0') ?? 0,
      pending: json['pending'] is int ? json['pending'] : int.tryParse(json['pending']?.toString() ?? '0') ?? 0,
      inProgress: json['in_progress'] is int ? json['in_progress'] : int.tryParse(json['in_progress']?.toString() ?? '0') ?? 0,
      resolved: json['resolved'] is int ? json['resolved'] : int.tryParse(json['resolved']?.toString() ?? '0') ?? 0,
      rejected: json['rejected'] is int ? json['rejected'] : int.tryParse(json['rejected']?.toString() ?? '0') ?? 0,
    );
  }
}
