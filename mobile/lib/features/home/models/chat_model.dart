class SuggestedActionModel {
  final String label;
  final String action;

  SuggestedActionModel({
    required this.label,
    required this.action,
  });

  factory SuggestedActionModel.fromJson(Map<String, dynamic> json) {
    return SuggestedActionModel(
      label: json['label']?.toString() ?? '',
      action: json['action']?.toString() ?? '',
    );
  }
}

class ChatMessageModel {
  final int id;
  final int sessionId;
  final String senderType; // user, bot, agent, system
  final int? senderId;
  final String senderName;
  final String message;
  final String? attachmentUrl;
  final String? attachmentType;
  final List<SuggestedActionModel> suggestedActions;
  final bool isReadByUser;
  final DateTime createdAt;

  ChatMessageModel({
    required this.id,
    required this.sessionId,
    required this.senderType,
    this.senderId,
    required this.senderName,
    required this.message,
    this.attachmentUrl,
    this.attachmentType,
    required this.suggestedActions,
    required this.isReadByUser,
    required this.createdAt,
  });

  /// Mengembalikan full URL untuk attachment gambar (baik dari path relatif maupun absolut)
  String? getFullAttachmentUrl([String? baseOrigin]) {
    if (attachmentUrl == null || attachmentUrl!.trim().isEmpty) return null;
    final trimmed = attachmentUrl!.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    String origin = (baseOrigin != null && baseOrigin.trim().isNotEmpty)
        ? baseOrigin.trim()
        : 'https://rimbunbuanasejahtera.com';

    if (origin.endsWith('/api')) {
      origin = origin.substring(0, origin.length - 4);
    } else if (origin.endsWith('/api/')) {
      origin = origin.substring(0, origin.length - 5);
    }
    origin = origin.replaceAll(RegExp(r'/+$'), '');

    if (trimmed.startsWith('/')) {
      return '$origin$trimmed';
    }
    return '$origin/$trimmed';
  }

  factory ChatMessageModel.fromJson(Map<String, dynamic> json) {
    DateTime parsedCreatedAt = DateTime.now();
    if (json['created_at'] != null) {
      try {
        parsedCreatedAt = DateTime.parse(json['created_at'].toString());
      } catch (_) {}
    }

    List<SuggestedActionModel> actions = [];
    if (json['suggested_actions'] != null && json['suggested_actions'] is List) {
      actions = (json['suggested_actions'] as List)
          .map((item) => SuggestedActionModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }

    return ChatMessageModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      sessionId: json['chat_session_id'] is int
          ? json['chat_session_id']
          : int.tryParse(json['chat_session_id']?.toString() ?? '0') ?? 0,
      senderType: json['sender_type']?.toString() ?? 'bot',
      senderId: json['sender_id'] != null ? int.tryParse(json['sender_id'].toString()) : null,
      senderName: json['sender_name']?.toString() ?? '',
      message: json['message']?.toString() ?? '',
      attachmentUrl: json['attachment_url']?.toString(),
      attachmentType: json['attachment_type']?.toString(),
      suggestedActions: actions,
      isReadByUser: json['is_read_by_user'] == true || json['is_read_by_user'] == 1,
      createdAt: parsedCreatedAt,
    );
  }
}

class ChatSessionModel {
  final int id;
  final String sessionCode;
  final int? userId;
  final String role;
  final String companyName;
  final String userName;
  final String? userNik;
  final String status; // bot, waiting_agent, active_agent, closed
  final int? assignedAgentId;
  final String? assignedAgentName;
  final String? lastMessageText;
  final DateTime? lastMessageAt;
  final DateTime createdAt;

  ChatSessionModel({
    required this.id,
    required this.sessionCode,
    this.userId,
    required this.role,
    required this.companyName,
    required this.userName,
    this.userNik,
    required this.status,
    this.assignedAgentId,
    this.assignedAgentName,
    this.lastMessageText,
    this.lastMessageAt,
    required this.createdAt,
  });

  factory ChatSessionModel.fromJson(Map<String, dynamic> json) {
    DateTime parsedCreatedAt = DateTime.now();
    if (json['created_at'] != null) {
      try {
        parsedCreatedAt = DateTime.parse(json['created_at'].toString());
      } catch (_) {}
    }

    DateTime? parsedLastMsgAt;
    if (json['last_message_at'] != null) {
      try {
        parsedLastMsgAt = DateTime.parse(json['last_message_at'].toString());
      } catch (_) {}
    }

    String? agentName;
    if (json['assigned_agent'] != null && json['assigned_agent'] is Map) {
      agentName = json['assigned_agent']['name']?.toString();
    }

    return ChatSessionModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      sessionCode: json['session_code']?.toString() ?? '',
      userId: json['user_id'] != null ? int.tryParse(json['user_id'].toString()) : null,
      role: json['role']?.toString() ?? 'karyawan',
      companyName: json['company_name']?.toString() ?? 'riama',
      userName: json['user_name']?.toString() ?? '',
      userNik: json['user_nik']?.toString(),
      status: json['status']?.toString() ?? 'bot',
      assignedAgentId: json['assigned_agent_id'] != null
          ? int.tryParse(json['assigned_agent_id'].toString())
          : null,
      assignedAgentName: agentName,
      lastMessageText: json['last_message_text']?.toString(),
      lastMessageAt: parsedLastMsgAt,
      createdAt: parsedCreatedAt,
    );
  }
}
