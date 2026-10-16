class AnnouncementModel {
  final int id;
  final String title;
  final String content;
  final String? attachmentPath;
  final String? attachmentName;
  final String? attachmentType;
  final String? attachmentUrl;
  final String? category;
  final String? company;
  final bool isPinned;
  final String? publishedAt;
  final String? authorName;

  AnnouncementModel({
    required this.id,
    required this.title,
    required this.content,
    this.attachmentPath,
    this.attachmentName,
    this.attachmentType,
    this.attachmentUrl,
    this.category,
    this.company,
    this.isPinned = false,
    this.publishedAt,
    this.authorName,
  });

  factory AnnouncementModel.fromJson(Map<String, dynamic> json) {
    String? author;
    if (json['author'] is Map && json['author']['name'] != null) {
      author = json['author']['name'].toString();
    }

    return AnnouncementModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      title: json['title']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      attachmentPath: json['attachment_path']?.toString(),
      attachmentName: json['attachment_name']?.toString(),
      attachmentType: json['attachment_type']?.toString(),
      attachmentUrl: json['attachment_url']?.toString(),
      category: json['category']?.toString(),
      company: json['company']?.toString(),
      isPinned: json['is_pinned'] == true || json['is_pinned'] == 1,
      publishedAt: json['published_at']?.toString() ?? json['created_at']?.toString(),
      authorName: author,
    );
  }
}
