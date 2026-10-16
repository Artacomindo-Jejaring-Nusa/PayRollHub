import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../core/storage/token_storage.dart';
import '../../auth/models/user_model.dart';
import '../models/chat_model.dart';
import '../services/chat_service.dart';

class LiveChatScreen extends StatefulWidget {
  final UserModel user;

  const LiveChatScreen({super.key, required this.user});

  @override
  State<LiveChatScreen> createState() => _LiveChatScreenState();
}

class _LiveChatScreenState extends State<LiveChatScreen> {
  bool _isLoading = true;
  bool _isSending = false;
  ChatSessionModel? _session;
  List<ChatMessageModel> _messages = [];

  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final ImagePicker _picker = ImagePicker();

  File? _selectedPhoto;
  Timer? _pollTimer;
  WebSocket? _ws;
  Timer? _wsReconnectTimer;

  bool get _isRiama => widget.user.isRiama;
  Color get _primaryColor => _isRiama ? const Color(0xFF065F46) : const Color(0xFF0F2B5C);

  @override
  void initState() {
    super.initState();
    _loadSession();
    _startPolling();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _wsReconnectTimer?.cancel();
    try {
      _ws?.close();
    } catch (_) {}
    _textController.dispose();
    _scrollController.dispose();
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
    );
    super.dispose();
  }

  void _connectWebSocket() async {
    if (_session == null) return;
    try {
      try {
        _ws?.close();
      } catch (_) {}

      final baseUrl = await TokenStorage.getBaseUrl();
      String wsUrl;
      if (baseUrl.startsWith('https://')) {
        wsUrl = baseUrl.replaceAll('/api', '').replaceAll('https://', 'wss://') + '/ws';
      } else {
        final uri = Uri.parse(baseUrl);
        wsUrl = 'ws://${uri.host}:6001';
      }

      _ws = await WebSocket.connect(wsUrl).timeout(const Duration(seconds: 4));

      final subPayload = jsonEncode({
        'action': 'subscribe',
        'channel': 'session_${_session!.id}',
      });
      _ws!.add(subPayload);

      _ws!.listen((data) {
        if (!mounted) return;
        try {
          final payload = jsonDecode(data.toString());
          final event = payload['event'];
          final eventData = payload['data'];

          if (event == 'new_message' && eventData is Map<String, dynamic>) {
            final msg = ChatMessageModel.fromJson(eventData);
            if (!_messages.any((m) => m.id == msg.id)) {
              setState(() {
                _messages.add(msg);
              });
              _scrollToBottom();
            }
          } else if (event == 'agent_claimed' || event == 'status_changed' || event == 'session_closed') {
            _loadSession(silent: true);
          }
        } catch (_) {}
      }, onDone: () {
        _scheduleWsReconnect();
      }, onError: (_) {
        _scheduleWsReconnect();
      });
    } catch (_) {
      _scheduleWsReconnect();
    }
  }

  void _scheduleWsReconnect() {
    _wsReconnectTimer?.cancel();
    if (!mounted || _session == null) return;
    _wsReconnectTimer = Timer(const Duration(seconds: 4), () {
      if (mounted && _session != null) {
        _connectWebSocket();
      }
    });
  }

  void _startPolling() {
    _pollTimer = Timer.periodic(const Duration(milliseconds: 2500), (timer) {
      if (!mounted || _session == null || _session!.status == 'closed') return;
      _pollMessages();
    });
  }

  Future<void> _loadSession({bool silent = false}) async {
    if (!silent) setState(() => _isLoading = true);
    final res = await ChatService.getActiveSession();

    if (!mounted) return;
    if (res['success'] == true) {
      setState(() {
        _session = res['session'] as ChatSessionModel?;
        _messages = (res['messages'] as List<ChatMessageModel>?) ?? [];
        if (!silent) _isLoading = false;
      });
      _scrollToBottom();
      _connectWebSocket();
    } else {
      if (!silent) setState(() => _isLoading = false);
      if (!silent) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message']?.toString() ?? 'Gagal terhubung ke layanan chat.')),
        );
      }
    }
  }

  Future<void> _pollMessages() async {
    if (_session == null) return;
    final lastMsg = _messages.isNotEmpty ? _messages.last : null;
    final lastId = lastMsg?.id ?? 0;

    final res = await ChatService.pollMessages(_session!.id, lastId);
    if (!mounted) return;

    if (res['success'] == true) {
      final newItems = res['messages'] as List<ChatMessageModel>;
      final newStatus = res['status']?.toString();

      if (newItems.isNotEmpty) {
        setState(() {
          _messages.addAll(newItems);
        });
        _scrollToBottom();
      }

      if (newStatus != null && newStatus != _session!.status) {
        setState(() {
          _session = ChatSessionModel(
            id: _session!.id,
            sessionCode: _session!.sessionCode,
            userId: _session!.userId,
            role: _session!.role,
            companyName: _session!.companyName,
            userName: _session!.userName,
            userNik: _session!.userNik,
            status: newStatus,
            assignedAgentId: _session!.assignedAgentId,
            assignedAgentName: _session!.assignedAgentName,
            lastMessageText: _session!.lastMessageText,
            lastMessageAt: _session!.lastMessageAt,
            createdAt: _session!.createdAt,
          );
        });
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage({String? customMessage, String? actionCode}) async {
    if (_session == null) return;
    final text = customMessage ?? _textController.text.trim();
    if (text.isEmpty && _selectedPhoto == null && actionCode == null) return;

    setState(() => _isSending = true);
    _textController.clear();
    final photoToSend = _selectedPhoto;
    setState(() => _selectedPhoto = null);

    final res = await ChatService.sendMessage(
      sessionId: _session!.id,
      message: text.isNotEmpty ? text : null,
      photo: photoToSend,
      actionCode: actionCode,
    );

    if (!mounted) return;
    setState(() => _isSending = false);

    if (res['success'] == true) {
      final userMsg = res['user_message'] as ChatMessageModel?;
      final botMsg = res['bot_message'] as ChatMessageModel?;
      final updatedSession = res['session'] as ChatSessionModel?;

      setState(() {
        if (updatedSession != null) _session = updatedSession;
        if (userMsg != null) _messages.add(userMsg);
        if (botMsg != null) _messages.add(botMsg);
      });
      _scrollToBottom();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message']?.toString() ?? 'Gagal mengirim pesan.'),
          backgroundColor: Colors.red.shade700,
        ),
      );
    }
  }

  Future<void> _requestAgent() async {
    if (_session == null) return;
    setState(() => _isSending = true);

    final res = await ChatService.requestAgent(_session!.id);
    if (!mounted) return;
    setState(() => _isSending = false);

    if (res['success'] == true) {
      final updatedSession = res['session'] as ChatSessionModel?;
      final sysMsg = res['system_message'] as ChatMessageModel?;

      setState(() {
        if (updatedSession != null) _session = updatedSession;
        if (sysMsg != null) _messages.add(sysMsg);
      });
      _scrollToBottom();
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picked = await _picker.pickImage(
        source: source,
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 80,
      );
      if (picked != null) {
        setState(() {
          _selectedPhoto = File(picked.path);
        });
      }
    } catch (e) {
      debugPrint('Error picking image: $e');
    }
  }

  void _showImageSourceSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Pilih Sumber Foto Bukti',
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                  color: const Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 12),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _primaryColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.camera_alt_rounded, color: _primaryColor),
                ),
                title: Text(
                  'Ambil dari Kamera',
                  style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickImage(ImageSource.camera);
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.photo_library_rounded, color: Colors.blue),
                ),
                title: Text(
                  'Pilih dari Galeri',
                  style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickImage(ImageSource.gallery);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showFullscreenImage(String imageUrl) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          alignment: Alignment.topRight,
          children: [
            InteractiveViewer(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image.network(
                  imageUrl,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => Container(
                    padding: const EdgeInsets.all(24),
                    color: Colors.white,
                    child: const Text('Gagal memuat gambar.'),
                  ),
                ),
              ),
            ),
            IconButton(
              icon: const CircleAvatar(
                backgroundColor: Colors.black54,
                child: Icon(Icons.close, color: Colors.white, size: 20),
              ),
              onPressed: () => Navigator.pop(ctx),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final status = _session?.status ?? 'bot';
    final isWaiting = status == 'waiting_agent';
    final isActive = status == 'active_agent';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        systemOverlayStyle: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
        ),
        backgroundColor: _primaryColor,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
          onPressed: () {
            SystemChrome.setSystemUIOverlayStyle(
              const SystemUiOverlayStyle(
                statusBarColor: Colors.transparent,
                statusBarIconBrightness: Brightness.dark,
                statusBarBrightness: Brightness.light,
                systemNavigationBarColor: Colors.white,
                systemNavigationBarIconBrightness: Brightness.dark,
              ),
            );
            Navigator.pop(context);
          },
        ),
        title: Row(
          children: [
            Stack(
              children: [
                CircleAvatar(
                  radius: 19,
                  backgroundColor: Colors.white.withOpacity(0.2),
                  child: Icon(
                    isActive ? Icons.support_agent_rounded : Icons.smart_toy_rounded,
                    color: Colors.white,
                    size: 22,
                  ),
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      shape: BoxShape.circle,
                      border: Border.all(color: _primaryColor, width: 2),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isActive
                        ? (_session?.assignedAgentName ?? 'CS Agent HRD')
                        : 'Live Chat & Bantuan AI',
                    style: GoogleFonts.plusJakartaSans(
                      color: Colors.white,
                      fontSize: 14.5,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    isWaiting
                        ? '⏳ Menunggu CS...'
                        : isActive
                            ? '👨‍💼 Agen Aktif'
                            : '🤖 Asisten Virtual AI',
                    style: GoogleFonts.plusJakartaSans(
                      color: Colors.white.withOpacity(0.85),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.white),
            tooltip: 'Segarkan Chat',
            onPressed: _loadSession,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Quick FAQ Chips Carousel
            Container(
              height: 44,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              color: Colors.white,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _buildFaqChip('💰 Jadwal Gaji', 'ask_payroll_schedule'),
                  _buildFaqChip('📍 Kendala GPS', 'ask_attendance_guide'),
                  _buildFaqChip('👤 Hubungi CS Live', 'request_agent'),
                ],
              ),
            ),

            // Escalation Banner to CS
            if (status == 'bot')
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                color: const Color(0xFFFEF3C7),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline_rounded, color: Color(0xFFB45309), size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Pertanyaan tidak terjawab oleh AI? Hubungkan ke CS.',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF92400E),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    InkWell(
                      onTap: _requestAgent,
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFD97706),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'Panggil CS',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // Waiting Queue Banner
            if (isWaiting)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                color: const Color(0xFFE0F2FE),
                child: Row(
                  children: [
                    const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0284C7)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Anda berada di antrean CS HRD. Mohon tunggu...',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF0369A1),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // Messages List
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      itemCount: _messages.length,
                      itemBuilder: (context, index) {
                        final msg = _messages[index];
                        return _buildMessageBubble(msg);
                      },
                    ),
            ),

            // Selected Photo Preview Banner
            if (_selectedPhoto != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                color: Colors.grey.shade100,
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.file(_selectedPhoto!, width: 44, height: 44, fit: BoxFit.cover),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Foto terlampir siap dikirim',
                        style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.red, size: 20),
                      onPressed: () => setState(() => _selectedPhoto = null),
                    ),
                  ],
                ),
              ),

            // Bottom Input Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 8,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.add_photo_alternate_rounded, color: Color(0xFF64748B), size: 24),
                    onPressed: _showImageSourceSheet,
                    tooltip: 'Lampirkan Foto',
                  ),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: TextField(
                        controller: _textController,
                        style: GoogleFonts.plusJakartaSans(fontSize: 13, color: const Color(0xFF1E293B)),
                        decoration: InputDecoration(
                          hintText: 'Tulis pertanyaan / kendala...',
                          hintStyle: GoogleFonts.plusJakartaSans(fontSize: 12.5, color: const Color(0xFF94A3B8)),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _isSending ? null : () => _sendMessage(),
                    child: CircleAvatar(
                      radius: 20,
                      backgroundColor: _primaryColor,
                      child: _isSending
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFaqChip(String label, String actionCode) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: () => _sendMessage(actionCode: actionCode),
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Center(
            child: Text(
              label,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF334155),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessageModel msg) {
    final isUser = msg.senderType == 'user';
    final isBot = msg.senderType == 'bot';
    final isAgent = msg.senderType == 'agent';
    final isSystem = msg.senderType == 'system';

    if (isSystem) {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        alignment: Alignment.center,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFFE2E8F0),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            msg.message,
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 11,
              color: const Color(0xFF475569),
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isUser) ...[
            CircleAvatar(
              radius: 14,
              backgroundColor: isAgent ? const Color(0xFFD1FAE5) : const Color(0xFFE0E7FF),
              child: Icon(
                isAgent ? Icons.support_agent_rounded : Icons.smart_toy_rounded,
                size: 16,
                color: isAgent ? const Color(0xFF047857) : const Color(0xFF4338CA),
              ),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isUser
                        ? _primaryColor
                        : isAgent
                            ? Colors.white
                            : Colors.white,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isUser ? 16 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 16),
                    ),
                    border: isUser
                        ? null
                        : Border.all(
                            color: isAgent ? const Color(0xFFA7F3D0) : const Color(0xFFE2E8F0),
                            width: 1,
                          ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.04),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (isAgent)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text(
                            '👨‍💼 ${msg.senderName} (CS HRD)',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF047857),
                            ),
                          ),
                        ),
                      Text(
                        msg.message,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          color: isUser ? Colors.white : const Color(0xFF1E293B),
                          height: 1.4,
                        ),
                      ),
                      if (msg.attachmentUrl != null && msg.attachmentUrl!.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        GestureDetector(
                          onTap: () => _showFullscreenImage(msg.attachmentUrl!),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.network(
                              msg.attachmentUrl!,
                              width: 180,
                              height: 130,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 180,
                                height: 80,
                                color: Colors.grey.shade200,
                                child: const Center(child: Text('Foto terlampir')),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                // Bot Action Buttons (Clickable Pills)
                if (isBot && msg.suggestedActions.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: msg.suggestedActions.map((action) {
                        return InkWell(
                          onTap: () => _sendMessage(actionCode: action.action),
                          borderRadius: BorderRadius.circular(16),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFDF5),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFA7F3D0)),
                            ),
                            child: Text(
                              action.label,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF065F46),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                // Timestamp
                Padding(
                  padding: const EdgeInsets.only(top: 3, left: 2, right: 2),
                  child: Text(
                    DateFormat('HH:mm').format(msg.createdAt),
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 9.5,
                      color: const Color(0xFF94A3B8),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
