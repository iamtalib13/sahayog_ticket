// --- 1. HIDE PRIVACY TOGGLE BUTTONS GLOBALLY FOR TICKET FORM ---
frappe.dom.set_style(`
    /* Hide standard sidebar lock/unlock icons and Make Private actions */
    body.ticket-active-form [data-action="toggle_private"],
    body.ticket-active-form [data-action="make_private"],
    body.ticket-active-form .btn-private,
    body.ticket-active-form .btn-public,
    /* Hide dynamically tagged Vue elements inside the Uploader */
    body.ticket-active-form .force-hide-privacy-btn {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
    }
    #chat-history-dynamic::-webkit-scrollbar { width: 6px; }
    #chat-history-dynamic::-webkit-scrollbar-track { background: transparent; }
    #chat-history-dynamic::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    #chat-history-dynamic::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

    /* Force white color for all content inside own message bubbles (including edited text) */
    #chat-history-dynamic [style*="background:#04665b"] * {
        color: white !important;
    }

    /* Notification dot bounce animation */
    @keyframes chatbot-bounce {
        0%, 100% { transform: translateY(0) scale(1); }
        20%       { transform: translateY(-7px) scale(1.15); }
        40%       { transform: translateY(-3px) scale(1); }
        60%       { transform: translateY(-5px) scale(1.08); }
        80%       { transform: translateY(-1px) scale(1); }
    }
    .chat-notification-dot.chatbot-bouncing {
        animation: chatbot-bounce 0.9s ease-in-out infinite;
        display: block !important;
    }
`, 'ticket-file-privacy-css');

// --- 2. VUE INTERCEPTOR (MUTATION OBSERVER) ---
// This continuously monitors the File Uploader modal and actively hides the Private toggles
const ticketPrivacyObserver = new MutationObserver((mutations) => {
    // Only run if we are on the Sahayog Ticket form AND a modal is open
    if ($('body').hasClass('ticket-active-form') && $('.modal-dialog').length > 0) {
        
        // Target buttons and checkboxes inside the modal that aren't hidden yet
        $('.modal-dialog label.frappe-checkbox:not(.force-hide-privacy-btn), .modal-dialog button:not(.force-hide-privacy-btn)').each(function() {
            // Clean up the text to match reliably
            let text = $(this).text().toLowerCase().trim().replace(/\s+/g, ' ');
            
            if (text === 'private' || text === 'set all private' || text === 'set all public') {
                $(this).addClass('force-hide-privacy-btn');
            }
        });
    }
});

// Start observing the DOM
ticketPrivacyObserver.observe(document.body, { childList: true, subtree: true });

// Listen to route changes to safely add/remove the CSS scope
frappe.router.on('change', () => {
    if (frappe.get_route()[0] === 'Form' && frappe.get_route()[1] === 'Sahayog Ticket') {
        $('body').addClass('ticket-active-form');
    } else {
        $('body').removeClass('ticket-active-form');
        $(".chatbot-fab, .chatbot-floating-window").remove();
    }
});
// -------------------------------------------------------------

// --- 3. ENFORCE DIGIT LIMITS & NUMERIC VALIDATION FOR ACCOUNT/CONTACT NUMBERS & PAN ---
$(document).on('focus', 'input[data-fieldname="account_number"]', function() {
    $(this).attr('maxlength', 15);
});

$(document).on('focus', 'input[data-fieldname="contact_number"], input[data-fieldname="new_contact_number"]', function() {
    $(this).attr('maxlength', 10);
});

$(document).on('focus', 'input[data-fieldname="new_pan_no"]', function() {
    $(this).attr('maxlength', 10);
});

$(document).on('input', 'input[data-fieldname="account_number"]', function() {
    let val = $(this).val().replace(/\D/g, '');
    if (val.length > 15) {
        val = val.slice(0, 15);
    }
    if ($(this).val() !== val) {
        $(this).val(val).trigger('change');
    }
});

$(document).on('input', 'input[data-fieldname="contact_number"], input[data-fieldname="new_contact_number"]', function() {
    let val = $(this).val().replace(/\D/g, '');
    // Handle Indian mobile prefixes (e.g. +91, 91, or 0)
    if (val.length > 10) {
        if (val.startsWith('91') && val.length === 12) {
            val = val.slice(2);
        } else if (val.startsWith('0') && val.length === 11) {
            val = val.slice(1);
        }
    }
    // Limit to 10 digits and ensure it starts with 6-9
    if (val.length > 0 && !/^[6-9]/.test(val)) {
        val = val.slice(1);
    }
    if (val.length > 10) {
        val = val.slice(0, 10);
    }
    if ($(this).val() !== val) {
        $(this).val(val).trigger('change');
    }
});

$(document).on('input', 'input[data-fieldname="new_pan_no"]', function() {
    let val = $(this).val().toUpperCase();
    let cleanVal = "";
    // Enforce PAN format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)
    for (let i = 0; i < val.length; i++) {
        let char = val[i];
        if (i < 5) {
            if (/[A-Z]/.test(char)) cleanVal += char;
        } else if (i >= 5 && i < 9) {
            if (/[0-9]/.test(char)) cleanVal += char;
        } else if (i === 9) {
            if (/[A-Z]/.test(char)) cleanVal += char;
        }
    }
    if (cleanVal.length > 10) {
        cleanVal = cleanVal.slice(0, 10);
    }
    if ($(this).val() !== cleanVal) {
        $(this).val(cleanVal).trigger('change');
    }
});

// Copyright (c) 2023, Sid and contributors

frappe.ui.form.on("Sahayog Ticket", {


  setup: function(frm) {
    // --- CUSTOM FILE UPLOADER OVERRIDE ---
    if (frappe.ui.form.ControlAttach && !frappe.ui.form.ControlAttach.prototype._original_set_upload_options) {
        frappe.ui.form.ControlAttach.prototype._original_set_upload_options = frappe.ui.form.ControlAttach.prototype.set_upload_options;
        
        frappe.ui.form.ControlAttach.prototype.set_upload_options = function() {
            this._original_set_upload_options();
            // Apply this to Sahayog Ticket
            if (this.frm && this.frm.doctype === "Sahayog Ticket") {
                this.upload_options.make_attachments_public = true;
            }
        };
    }
  },


  refresh: function (frm) {
    // Ensure CSS class is applied on reload
    $('body').addClass('ticket-active-form');

    // Trigger custom functions
    frm.trigger("common_hidden_fields");
    frm.trigger("hide_timeline");
    frm.trigger("hide_sidebar_options");
    frm.trigger("custom_buttons");
    frm.trigger("reset_user_password");
    frm.trigger("status");

    // Check if the user is an employee and has a specific role
    if (frm.doc.status === "Closed") {
      frappe.show_alert("This ticket is closed and cannot be edited.");
      frm.disable_form();
    }

    if (frm.is_new()) {
      frm.trigger("Employee_hidden_fields");
    } else if (!frm.is_new()) {
      if (
        frappe.user.has_role("IT Support Executive") ||
        frappe.user.has_role("Admin Support Executive") ||
        frappe.user.has_role("Stationery Store & Support Manager")
      ) {
        frm.trigger("create_asset_request");
      }

      frm.trigger("it_support_manager_fields_show");
      // frm.trigger("set_intro");
    }

    // Button visibility and form control logic
    if (frm.is_new()) {
      frm.set_df_property("cancel_ticket_btn", "hidden", 1);
    }

    if (!frm.is_new()) {
      if (
        frappe.user.has_role("IT Support Executive") ||
        frappe.user.has_role("Admin Support Executive") ||
        frappe.user.has_role("Operations Support Executive") ||
        frappe.user.has_role("HR Support Executive") ||
        frappe.user.has_role("Accounts Support Executive") ||
        frappe.user.has_role("HO Support Executive") ||
        frappe.user.has_role("Facility Support Executive") ||
        frappe.user.has_role("Loan Support Executive") ||
        frappe.user.has_role("CBS Support Executive")
      ) {

        if (frm.doc.status === "Open") {
          frm.trigger("In_Progress_button");
          frm.trigger("resolve_button");
        } else if (frm.doc.status === "In-Progress") {
          frm.trigger("assign_to_button");
          frm.trigger("resolve_button");
          frm.trigger("executive_remark");
        }
      }

      if (frappe.user.has_role("System Manager")) {
      } else if (frappe.user.has_role("Employee")) {
        if (
          frm.doc.status === "Resolved" &&
          frm.doc.owner === frappe.session.user
        ) {
          frm.trigger("reopen_button");
          frm.trigger("close_button");
        }
      } else {
        if (frappe.user.has_role("CTO")) {
          frm.disable_save();
          frm.disable_form();
        } else {
          frm.set_df_property("cancel_ticket_btn", "hidden", 1);

          if (
            frm.doc.status == "Read" ||
            frm.doc.status == "In-Progress" ||
            frm.doc.status == "On-Hold"
          ) {
            frm.disable_save();
          }

          if (frm.doc.status == "Resolved") {
            frm.disable_save();
          }
        }
      }
    }

    if (frm.doc.dept_name == "" || null) {
      frm.doc.status = "New";
    }

    if (frappe.user.has_role("Stationery Store & Support Manager")) {
      frm.remove_custom_button("Resolved", "Status");
      frm.remove_custom_button("Read", "Status");
      frm.remove_custom_button("On-Hold", "Status");
      frm.remove_custom_button("In-Progress", "Status");
    }

    frm.trigger("hide_additional_details_from_timeline");
    frm.trigger("setup_floating_chatbot");
  },

  setup_floating_chatbot: function (frm) {
    if (frm.is_new()) return;

    // 1. Clean existing elements & clear any old polling timer
    $(".chatbot-wrapper-global").remove();
    if (window._chatbot_poll_timer) {
        clearInterval(window._chatbot_poll_timer);
        window._chatbot_poll_timer = null;
    }

    // 2. Global Wrapper
    let html = `
        <div class="chatbot-wrapper-global" style="
            position: fixed; bottom: 20px; right: 20px; z-index: 9999;
            display: flex; flex-direction: column; align-items: flex-end;
            font-family: 'Inter', sans-serif;
        ">
            <!-- Floating History Window -->
            <div class="chatbot-floating-window" style="
                width: 320px; height: 380px; background: var(--card-bg,white); border-radius: 16px;
                box-shadow: 0 12px 28px rgba(0,0,0,0.12); margin-bottom: 12px;
                display: none; flex-direction: column; overflow: hidden; border: 1px solid var(--border-color,#cbced1);
            ">
                <div class="chat-header" style="
                    padding: 10px 15px; background: linear-gradient(135deg, #00b09b);
                    color: white; display: flex; align-items: center; justify-content: space-between;
                ">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div>
                            <div style="font-weight: 700; font-size: 12px;">Support Assistant</div>
                        </div>
                    </div>
                    <i class="fa fa-times chat-close-trigger" style="cursor: pointer; opacity: 0.8; font-size: 14px;"></i>
                </div>
                
                <div id="chat-history-dynamic" style="
                    flex-grow: 1; overflow-y: auto; padding: 12px; display: flex;
                    flex-direction: column; gap: 4px; background-color: var(--bg-color,#f8fafc); scroll-behavior: smooth;
                    min-height: 0; overscroll-behavior: contain;
                "></div>

                <!-- Input Container (Inside Floating Window) -->
                <div class="chat-input-container" style="
                    display: flex; background: var(--card-bg,white); border-top: 1px solid var(--border-color,#e2e8f0);
                    padding: 8px 12px; flex-direction: column; gap: 4px; width: 100%;
                ">
                    <!-- Attachment Preview -->
                    <div id="chat-attachment-preview" style="display:none; align-items:center; gap:8px; background:var(--control-bg,#f1f5f9); padding:6px 8px; border-radius:12px; border:1px solid var(--border-color,#e2e8f0); margin-top: 4px;">
                        <div id="chat-attachment-image-wrapper" style="display:none; width:36px; height:36px; flex-shrink:0;">
                            <img id="chat-attachment-image-preview" style="width:100%; height:100%; object-fit:cover; border-radius:4px; border:1px solid var(--border-color,#cbd5e1);" />
                        </div>
                        <i id="chat-attachment-icon-fallback" class="fa fa-paperclip" style="color:var(--text-muted,#64748b); font-size:12px;"></i>
                        <span id="chat-attachment-name" style="flex-grow:1; font-size:11px; color:var(--text-color,#1e293b); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></span>
                        <i class="fa fa-times" id="chat-attachment-clear" style="cursor:pointer; color:var(--text-muted,#94a3b8); font-size:12px;"></i>
                    </div>

                    <div style="display:flex; align-items:center; gap:8px; width: 100%;">
                        <button id="chat-attach-dynamic" style="background: none; border: none; color: var(--text-muted,#94a3b8); font-size: 18px; cursor: pointer; padding: 0;">
                            <i class="fa fa-paperclip"></i>
                        </button>
                        <textarea id="chat-input-dynamic" placeholder="Type a message..." style="
                            flex-grow: 1; border: none; padding: 8px 0; font-size: 13px; color: var(--text-color,inherit);
                            outline: none; resize: none; height: 36px; background: transparent;
                            max-height: 100px;
                        "></textarea>
                        <input type="file" id="chat-file-input-dynamic" style="display:none;">
                        
                        <!-- Send Button -->
                        <button id="chat-send-btn" style="
                            background: linear-gradient(135deg, #00b09b);
                            border: none;
                            color: white;
                            width: 32px;
                            height: 32px;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            cursor: pointer;
                            font-size: 14px;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                            flex-shrink: 0;
                        ">
                            <i class="fa fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Bottom Row (Circular FAB) -->
            <div style="display: flex; align-items: flex-end; gap: 10px; width: 100%; justify-content: flex-end;">
                <!-- Circular FAB -->
                <div class="chatbot-fab" style="
                    position: relative;
                    width: 60px; height: 60px; background: linear-gradient(135deg, #00b09b);
                    color: white; border-radius: 50%; display: flex; align-items: center;
                    justify-content: center; font-size: 20px; cursor: pointer;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15); flex-shrink: 0;
                    transition: transform 0.2s;
                ">
                    <img src="/assets/sahayog_ticket/images/chatbot2.png" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />
                    <!-- Count Badge (hidden by default, shown only on unread msgs) -->
                    <div class="chat-notification-dot" style="
                        position: absolute; top: -5px; right: -5px;
                        min-width: 18px; height: 18px;
                        background: #ff4d4f;
                        border-radius: 9px; border: 2px solid white;
                        display: none; align-items: center; justify-content: center;
                        font-size: 10px; font-weight: 700; color: white;
                        padding: 0 4px; line-height: 1;
                        font-family: 'Inter', sans-serif;
                    "></div>
                </div>
            </div>
        </div>
    `;

    $("body").append(html);

    let fab = $(".chatbot-fab");
    let win = $(".chatbot-floating-window");
    let input = $("#chat-input-dynamic");
    let file_input = $("#chat-file-input-dynamic");
    let selected_file = null;

    // Attachment Click -> Trigger Native File Browser
    $("#chat-attach-dynamic").on('click', () => file_input.click());

    file_input.on('change', function() {
        if (this.files && this.files[0]) {
            selected_file = this.files[0];
            $("#chat-attachment-name").text(selected_file.name);
            $("#chat-attachment-preview").css('display', 'flex');

            // Show image thumbnail if file is an image
            if (selected_file.type.startsWith('image/')) {
                let reader = new FileReader();
                reader.onload = function(e) {
                    $("#chat-attachment-image-preview").attr('src', e.target.result);
                    $("#chat-attachment-image-wrapper").show();
                    $("#chat-attachment-icon-fallback").hide();
                }
                reader.readAsDataURL(selected_file);
            } else {
                $("#chat-attachment-image-wrapper").hide();
                $("#chat-attachment-icon-fallback").show();
            }
            input.focus();
        }
    });

    $("#chat-attachment-clear").on('click', function() {
        selected_file = null;
        file_input.val('');
        $("#chat-attachment-preview").hide();
        $("#chat-attachment-image-preview").attr('src', '');
        $("#chat-attachment-image-wrapper").hide();
        $("#chat-attachment-icon-fallback").show();
    });

    // --- Notification Helpers ---
    const _ticket_seen_key = () => `chatbot_last_seen_${frm.docname}`;

    function mark_messages_seen() {
        // Store current UTC timestamp as last-seen for this ticket (local)
        localStorage.setItem(_ticket_seen_key(), new Date().toISOString());
        // Remove bounce and hide dot
        $(".chat-notification-dot").removeClass('chatbot-bouncing').fadeOut(200);
        // Also persist seen time on server (for WhatsApp tick rendering)
        frappe.call({
            method: "sahayog_ticket.sahayog_ticket.doctype.sahayog_ticket.chat_utils.mark_ticket_chat_seen",
            args: { docname: frm.docname },
            freeze: false
        });
    }

    function check_unread_messages() {
        // Fetch ALL comments from others to count unread ones
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Comment",
                filters: {
                    reference_doctype: frm.doctype,
                    reference_name: frm.docname,
                    comment_type: ["in", ["Comment", "Attachment"]],
                    owner: ["!=", frappe.session.user]
                },
                fields: ["creation"],
                order_by: "creation desc",
                limit_page_length: 100
            },
            callback: function(r) {
                let dot = $(".chat-notification-dot");
                if (r.message && r.message.length > 0) {
                    let last_seen = localStorage.getItem(_ticket_seen_key());
                    // Count how many messages are newer than last_seen
                    let unread_count = last_seen
                        ? r.message.filter(c => new Date(c.creation) > new Date(last_seen)).length
                        : r.message.length;

                    if (unread_count > 0) {
                        // Show badge with count + bounce
                        dot.text(unread_count > 99 ? '99+' : unread_count);
                        dot.css('display', 'flex').addClass('chatbot-bouncing');
                    } else {
                        dot.removeClass('chatbot-bouncing');
                        if (dot.is(':visible')) dot.fadeOut(200);
                    }
                } else {
                    // No messages from others at all
                    dot.removeClass('chatbot-bouncing');
                    if (dot.is(':visible')) dot.fadeOut(200);
                }
            }
        });
    }

    // Initial check on load
    check_unread_messages();

    // Background poll every 15s, pause when tab is hidden
    window._chatbot_poll_timer = setInterval(function() {
        if (document.hidden) return;
        if ($(".chatbot-floating-window").is(':visible')) {
            frm.trigger("render_floating_chat_content");
        } else {
            check_unread_messages();
        }
    }, 15000);

    // FAB Action -> Click to Open Chat, Hide FAB
    fab.on('click', function() {
        mark_messages_seen(); // Mark as seen when opening
        fab.fadeOut(200, function() {
            win.css('display', 'flex').hide().fadeIn(200);
            // Force scroll to bottom on open
            setTimeout(() => chat_history.scrollTop(999999), 300);
            frm.trigger("render_floating_chat_content");
            input.focus();
        });
    });

    // Close Button -> Hide Chat, Show FAB
    $(".chat-close-trigger").on('click', () => {
        win.fadeOut(200, function() {
            fab.fadeIn(200);
        });
    });

    // Send Button Click
    $("#chat-send-btn").on('click', function() {
        send_chat_message();
    });

    // Enter to Send
    input.on('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            send_chat_message(); 
        }
    });

    // Auto-resize Input
    input.on('input', function() {
        this.style.height = '36px';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Function to send message
    function send_chat_message() {
        let message = input.val().trim();
        if (!message && !selected_file) return;

        let send_btn = $("#chat-send-btn");
        input.prop('disabled', true);
        send_btn.css('opacity', '0.5').css('pointer-events', 'none');

        if (selected_file) {
            // Silent upload using XMLHttpRequest
            let xhr = new XMLHttpRequest();
            let formData = new FormData();
            formData.append("file", selected_file);
            formData.append("doctype", frm.doctype);
            formData.append("docname", frm.docname);
            formData.append("is_private", 0); // Public attachment

            xhr.open("POST", "/api/method/upload_file", true);
            xhr.setRequestHeader("X-Frappe-CSRF-Token", frappe.csrf_token);
            
            xhr.onload = function () {
                if (xhr.status === 200) {
                    if (message) {
                        send_comment(message);
                    } else {
                        finalize_send();
                    }
                } else {
                    frappe.show_alert({message: __("Upload failed"), indicator: "red"});
                    input.prop('disabled', false);
                    send_btn.css('opacity', '1').css('pointer-events', 'auto');
                }
            };

            xhr.onerror = function () {
                frappe.show_alert({message: __("Network error"), indicator: "red"});
                input.prop('disabled', false);
                send_btn.css('opacity', '1').css('pointer-events', 'auto');
            };

            xhr.send(formData);
        } else {
            send_comment(message);
        }

        function send_comment(content) {
            frappe.call({
                method: "frappe.desk.form.utils.add_comment",
                args: {
                    reference_doctype: frm.doctype, reference_name: frm.docname,
                    content: content, comment_by: frappe.session.user, comment_email: frappe.session.user
                },
                callback: function() {
                    finalize_send();
                }
            });
        }

        function finalize_send() {
            input.val('').prop('disabled', false).css('height', '36px');
            send_btn.css('opacity', '1').css('pointer-events', 'auto');
            selected_file = null;
            file_input.val('');
            $("#chat-attachment-preview").hide();
            $("#chat-attachment-image-preview").attr('src', '');
            $("#chat-attachment-image-wrapper").hide();
            $("#chat-attachment-icon-fallback").show();
            // User is active in chat — mark as seen so dot stays hidden
            localStorage.setItem(`chatbot_last_seen_${frm.docname}`, new Date().toISOString());
            frm.trigger("render_floating_chat_content");
            input.focus();
        }
    }

    // Click Outside to Close
    $(document).on('mousedown.chat_outside', function(e) {
        let wrapper = $(".chatbot-wrapper-global");
        // Don't close if clicking inside chatbot or any modal/overlay
        if (win.is(":visible") && 
            !wrapper.is(e.target) && wrapper.has(e.target).length === 0 &&
            !$(e.target).closest('.modal, .modal-backdrop, .frappe-control-popup, .file-uploader').length
        ) {
            $(".chat-close-trigger").click();
        }
    });

    // Navigation Cleanup
    frappe.router.on('change', () => {
        if (frappe.get_route()[0] !== 'Form' || frappe.get_route()[1] !== 'Sahayog Ticket') {
            $(".chatbot-wrapper-global").remove();
            $(document).off('mousedown.chat_outside');
            if (window._chatbot_poll_timer) {
                clearInterval(window._chatbot_poll_timer);
                window._chatbot_poll_timer = null;
            }
        }
    });
  },

  render_floating_chat_content: function (frm) {
    let chat_history = $("#chat-history-dynamic");
    
    frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Comment",
        filters: { reference_doctype: frm.doctype, reference_name: frm.docname, comment_type: ["in", ["Comment", "Attachment", "Info"]] },
        fields: ["content", "owner", "creation", "comment_by", "comment_type"],
        order_by: "creation asc",
        limit_page_length: 0  // Fetch all comments
      },
      callback: function (r) {
        // Skip re-render if message count hasn't changed
        if (frm._last_chat_count && r.message && r.message.length === frm._last_chat_count) {
          return;
        }
        if (r.message) frm._last_chat_count = r.message.length;
        
        let history = [];
        let senders = new Set();
        if (r.message) {
          r.message.forEach((c) => {
            let content = c.content;
            if (c.comment_type === "Attachment" && content) {
              let file_url = "";
              if (content.includes("<a")) {
                  let match = content.match(/href="([^"]+)"/);
                  if (match) file_url = match[1];
              } else if (content.trim().startsWith("/") || content.trim().startsWith("http")) {
                  file_url = content.trim();
              }

              if (file_url) {
                  let filename = decodeURIComponent(file_url.split("/").pop().split("?")[0]);
                  let file_ext = filename.split('.').pop().toLowerCase();
                  
                  // Truncate long filename (keep first 20 chars + ... + extension)
                  let display_name = filename;
                  if (filename.length > 30) {
                    let name_without_ext = filename.substring(0, filename.lastIndexOf('.'));
                    display_name = name_without_ext.substring(0, 20) + '...' + file_ext;
                  }
                  
                  let image_exts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
                  
                  if (image_exts.includes(file_ext)) {
                      // IMAGE PREVIEW (WhatsApp style)
                      content = `<div style="margin: 4px 0;">
                                    <a href="${file_url}" target="_blank" style="display: block;">
                                        <img src="${file_url}" style="max-width: 100%; max-height: 180px; border-radius: 8px; border: 1px solid #e2e8f0; display: block; object-fit: cover;" onerror="this.src='/assets/frappe/images/default-image.svg'; this.style.opacity=0.5;"/>
                                    </a>
                                 </div>`;
                  } else {
                      // DOCUMENT CARD
                      let icon = "fa-file";
                      let icon_color = "#00b09b";
                      if (file_ext === 'pdf') { icon = "fa-file-pdf-o"; icon_color = "#e11d48"; }
                      else if (['doc', 'docx'].includes(file_ext)) { icon = "fa-file-word-o"; icon_color = "#2563eb"; }
                      else if (['xls', 'xlsx'].includes(file_ext)) { icon = "fa-file-excel-o"; icon_color = "#16a34a"; }
                      else if (['zip', 'rar', '7z'].includes(file_ext)) { icon = "fa-file-archive-o"; icon_color = "#7c3aed"; }

                      content = `<div style="display:flex; align-items:center; gap:8px; padding:6px; background: rgba(0,0,0,0.03); border-radius:10px; border: 1px solid rgba(0,0,0,0.05); margin: 4px 0;">
                                    <div style="width: 36px; height: 36px; background: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: ${icon_color}; font-size: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">
                                        <i class="fa ${icon}"></i>
                                    </div>
                                    <div style="flex:1; overflow: hidden;">
                                        <a href="${file_url}" target="_blank" style="font-weight: 600; color: #1e293b; font-size: 12px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: none;" title="${filename}">
                                            ${display_name}
                                        </a>
                                        <div style="display: flex; gap: 6px; align-items: center; margin-top: 2px;">
                                            <span style="font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 700;">${file_ext}</span>
                                            <span style="width: 3px; height: 3px; background: #cbd5e1; border-radius: 50%;"></span>
                                            <span style="font-size: 9px; color: #94a3b8; cursor: pointer;" onclick="event.stopPropagation(); window.open('${file_url}', '_blank');">Click to open</span>
                                        </div>
                                    </div>
                                 </div>`;
                  }
              }
            }
            let sender = c.comment_by || c.owner;
            
            // Parse Info type for Re-open status
            if (c.comment_type === "Info" && content.includes("Re-open Remark")) {
              let reopenMatch = content.match(/Ticket Status from (\w+) to (\w+)/);
              let remarkMatch = content.match(/Re-open Remark from .*? to (.+?)(?:,|·|$)/s);
              
              if (reopenMatch && remarkMatch) {
                let fromStatus = reopenMatch[1];
                let toStatus = reopenMatch[2];
                let remark = remarkMatch[1].replace(/\.+$/, '').trim(); // Remove trailing dots
                content = `<b>Status Re-opened:</b> ${fromStatus} → ${toStatus}<br><b>Remark:</b> ${remark}`;
              }
            }
            
            history.push({ 
              type: c.comment_type, 
              content: content, 
              by: sender, 
              date: c.creation, 
              is_system: c.comment_type === "Info" 
            });
            if (sender && sender !== 'Administrator' && sender !== frappe.session.user) senders.add(sender);
          });
        }
        if (frm.doc.status_log) {
          frm.doc.status_log.forEach((log) => {
            if (log.status_remark) {
              let statusMsg = `<b>Status Changed:</b> ${log.from_status} → ${log.to_status}`;
              
              // Get actual remark from parent doc based on status type
              let actualRemark = '';
              if (log.to_status === 'In-Progress' && frm.doc.executive_remark) {
                actualRemark = frm.doc.executive_remark;
              } else if (log.to_status === 'Resolved' && frm.doc.resolved_remark) {
                actualRemark = frm.doc.resolved_remark;
              } else if (log.to_status === 'Open' && log.from_status === 'Resolved' && frm.doc.reopen_remark) {
                actualRemark = frm.doc.reopen_remark;
              }
              
              if (actualRemark) {
                statusMsg += `<br><b>Remark:</b> ${actualRemark}`;
              }
              
              history.push({ 
                type: "Status", 
                content: statusMsg, 
                by: log.status_change_by, 
                date: log.status_change_on, 
                is_system: true 
              });
              if (log.status_change_by && log.status_change_by !== 'Administrator' && log.status_change_by !== frappe.session.user) senders.add(log.status_change_by);
            }
          });
        }
        history.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Helper: fetch seen_map then render
        function fetch_seen_and_render(history, emp_map) {
          frappe.call({
            method: "sahayog_ticket.sahayog_ticket.doctype.sahayog_ticket.chat_utils.get_ticket_chat_seen",
            args: { docname: frm.docname },
            freeze: false,
            callback: function(seen_res) {
              let seen_map = seen_res.message || {};
              render_history(history, emp_map, seen_map);
            }
          });
        }

        // Fetch Employee details for senders
        if (senders.size > 0) {
          frappe.call({
            method: "frappe.client.get_list",
            args: {
              doctype: "Employee",
              filters: { user_id: ["in", Array.from(senders)] },
              fields: ["user_id", "employee_name", "employee_number", "name"]
            },
            callback: function(res) {
              let emp_map = {};
              (res.message || []).forEach(e => {
                emp_map[e.user_id] = { name: e.employee_name, id: e.employee_number || e.name };
              });
              fetch_seen_and_render(history, emp_map);
            }
          });
        } else {
          fetch_seen_and_render(history, {});
        }

        function render_history(history, emp_map, seen_map) {
          seen_map = seen_map || {};
          
          chat_history.empty();
          if (history.length === 0) chat_history.append('<p style="text-align:center; color:var(--text-muted,#94a3b8); font-size:11px; margin-top:10px;">No messages.</p>');
          let last_sender = null;
          history.forEach((item) => {
            let is_me = item.by === frappe.session.user;
            let time = frappe.datetime.get_time(item.date).split(':').slice(0, 2).join(':');
            if (item.is_system) {
              let system_user = '';
              if (item.type === 'Status') {
                if (item.by === frappe.session.user) {
                  system_user = ' by You';
                } else if (item.by === 'Administrator') {
                  system_user = ' by Administrator';
                } else {
                  let emp = emp_map[item.by];
                  let name = emp ? emp.name.split(' ')[0] : (item.by ? item.by.split('@')[0] : '');
                  system_user = name ? ` by ${name}` : '';
                }
              }
              chat_history.append(`<div style="align-self:center; background:var(--control-bg,#eef2f6); color:var(--text-muted,#64748b); padding:6px 12px; border-radius:12px; font-size:10px; text-align:left; max-width:85%; margin:4px 0; border:1px solid var(--border-color,#dfe5ec); word-wrap:break-word; white-space:normal;">${item.content}${system_user} ${time}</div>`);
              last_sender = null;
            } else {
              let show_sender = item.by !== last_sender;
              last_sender = item.by;
              
              let display_name = 'You';
              if (!is_me) {
                if (item.by === 'Administrator') {
                  display_name = 'Administrator';
                } else {
                  let emp = emp_map[item.by];
                  let first_name = emp ? emp.name.split(' ')[0] : (item.by.split('@')[0]);
                  let emp_id = emp ? emp.id : (item.by.split('@')[0]);
                  display_name = `${first_name} (${emp_id})`;
                }
              }

              // --- WhatsApp-style seen tick (only on current user's messages) ---
              let tick_html = '';
              if (is_me) {
                let msg_time = new Date(item.date);
                // Check if any OTHER user has a seen_time AFTER this message was created
                let is_seen_by_other = Object.entries(seen_map).some(([u, seen_time]) => {
                  return u !== frappe.session.user && new Date(seen_time) >= msg_time;
                });
                let tick_color  = is_seen_by_other ? '#2ae9f7' : 'rgba(255,255,255,0.92)';
                let tick_symbol = is_seen_by_other
                  ? '&#10003;&#10003;'   // ✓✓ double tick (seen)
                  : '&#10003;';          // ✓  single tick (sent)
                tick_html = `<span style="font-size:10px; color:${tick_color}; letter-spacing:-1.5px; line-height:1;">${tick_symbol}</span>`;
              }

              chat_history.append(`
                  <div style="display:flex; gap:6px; flex-direction:${is_me ? 'row-reverse' : 'row'}; align-self:${is_me ? 'flex-end' : 'flex-start'}; max-width:90%; ${!show_sender ? 'margin-top:-2px;' : ''}">
                      <div style="display:flex; flex-direction:column; align-items:${is_me ? 'flex-end' : 'flex-start'};">
                          ${show_sender ? `<div style="font-size:9px; font-weight:600; color:var(--text-muted,#64748b); margin:0 4px 1px 4px;">${display_name}</div>` : ''}
                           <div style="background:${is_me ? '#04665b' : 'var(--card-bg,white)'}; color:${is_me ? 'white' : 'var(--text-color,#1e293b)'}; padding:4px 8px; border-radius:${is_me ? '10px 10px 2px 10px' : '10px 10px 10px 2px'}; box-shadow:0 1px 2px rgba(0,0,0,0.05); font-size:11px; line-height:1.4; border:${is_me ? 'none' : '1px solid var(--border-color,#e2e8f0)'}; min-width: 60px;">
                               <div style="word-break:break-word;">
                                   ${item.content}
                                   <span style="display:inline-flex; align-items:center; float:right; margin-left:6px; margin-top:4px; gap:2px; white-space:nowrap;">
                                       <span style="font-size:8px; opacity:0.7; font-weight:500;">${time}</span>
                                       ${tick_html}
                                   </span>
                               </div>
                           </div>
                      </div>
                  </div>
              `);
            }
          });
          setTimeout(() => {
            // Always scroll to bottom (WhatsApp behavior - new messages priority)
            chat_history.scrollTop(chat_history[0].scrollHeight);
          }, 100);
        }
      }
    });
  },

  onload: function (frm) {
    if (!frm.is_new()) {
      // frm.trigger("set_intro");

      delete frm.__intro_shown;
      $("#custom-ticket-intro").remove();

      if (frm.is_new() || frm.is_dirty()) return;

      setTimeout(() => {
        render_safe_intro_always_visible(frm);
      }, 100);
      setup_notify_branch_button(frm);
    }
  },

  before_save: function (frm) {
    // Employee ID is set server-side in set_employee_id()
  },

  assigned_to: function (frm) {
    if (!frm.doc.assigned_to || frm.is_new()) return;

    frappe.call({
      method: "sahayog_ticket.sahayog_ticket.doctype.sahayog_ticket.sahayog_ticket.send_assignment_email",
      args: {
        ticket_name: frm.doc.name,
        assigned_to: frm.doc.assigned_to
      }
    });
  },

  dept_name: function (frm) {
    frm.refresh_field("ticket_type");
    frm.set_query("ticket_type", function () {
      return {
        filters: {
          department: frm.doc.dept_name,
          enable: "1",
        },
      };
    });
  },

  status: function (frm) {
    if (!frm.is_new() && ["Open", "In-Progress", "Resolved", "Closed"].includes(frm.doc.status)) {
      frm.set_df_property("description", "read_only", 1);
    } else {
      frm.set_df_property("description", "read_only", 0);
    }
  },

  priority: function (frm) {
    frm.trigger("priority_for_it");
  },

  // Custom methods
  create_asset_request: function (frm) {
    if (frm.doc.asset_request_id) {
      frm.add_custom_button(__("View Asset Request"), function () {
        frappe.set_route("Form", "Asset Request", frm.doc.asset_request_id);
      });
    } else if (
      frm.doc.status === "On-Hold" ||
      frm.doc.status === "In-Progress" ||
      (frm.doc.status === "Open" &&
        (frappe.user.has_role("IT Support Executive") ||
          frappe.user.has_role("Admin Support Executive") ||
          frappe.user.has_role("Stationery Store & Support Manager")))
    ) {
      frm.add_custom_button(__("Create Material Request"), function () {
        frappe.call({
          method: "frappe.client.get_value",
          args: {
            doctype: "Sahayog Settings",
            filters: { name: "Sahayog Settings" },
            fieldname: ["create_stockio_request"],
          },
          callback: function (r) {
            if (r.message && r.message.create_stockio_request == 1) {
              const dept_map = { IT: "it", Stationery: "Stationery", Admin: "Asset" };
              const mapped_dept = dept_map[frm.doc.dept_name] || "Purchase";
              const remark = frm.doc.description || "";

              const d = new frappe.ui.Dialog({
                title: "Create Employee Material Request",
                fields: [
                  {
                    fieldname: "info_section",
                    fieldtype: "HTML",
                    options: `
                      <p><b>Employee:</b> ${frm.doc.employee_id || "N/A"}</p>
                      <p><b>Department:</b> ${mapped_dept}</p>
                      <p><b>Remark:</b> ${remark ? "[Remark: " + remark + "]" : "N/A"}</p>
                    `,
                  },
                  {
                    fieldname: "items_table",
                    fieldtype: "Table",
                    label: "Items",
                    cannot_add_rows: false,
                    in_place_edit: true,
                    reqd: 1,
                    data: [{ item_code: "", quantity: 1 }],
                    fields: [
                      {
                        fieldname: "item_code",
                        fieldtype: "Link",
                        label: "Item Code",
                        options: "Item",
                        in_list_view: 1,
                        reqd: 1,
                        columns: 3,
                      },
                      {
                        fieldname: "quantity",
                        fieldtype: "Float",
                        label: "Qty",
                        default: 1,
                        in_list_view: 1,
                        reqd: 1,
                        columns: 1,
                      },
                    ],
                  },
                ],
                primary_action_label: "Create",
                primary_action() {
                  const items_data = d.get_values().items_table;
                  if (!items_data || !items_data.length) {
                    frappe.msgprint("Please add at least one item");
                    return;
                  }

                  d.hide();
                  frappe.call({
                    method: "sahayog_ticket.sahayog_ticket.doctype.sahayog_ticket.sahayog_ticket.create_emmr_from_ticket",
                    args: {
                      ticket_id: frm.doc.name,
                      items: JSON.stringify(items_data),
                    },
                    freeze: true,
                    freeze_message: "Creating Employee Material Request...",
                    callback: function (res) {
                      if (res.message && res.message.emmr_id) {
                        frappe.show_alert({
                          message: __("EMMR created: " + res.message.emmr_id),
                          indicator: "green",
                        }, 5);
                      } else {
                        frappe.show_alert({
                          message: __("Please Try Again"),
                          indicator: "red",
                        }, 5);
                      }
                    },
                  });
                },
              });
              d.show();
              return;
            }

            let request_department = "";
            if (frappe.user.has_role("IT Support Executive")) {
              request_department = "IT";
            } else if (frappe.user.has_role("Admin Support Executive")) {
              request_department = "Admin";
            } else if (frappe.user.has_role("Stationery Store & Support Manager")) {
              request_department = "Stationery";
            }

            let user = frappe.session.user;
            frappe.confirm(
              __("Are you sure you want to create Asset Request?"),
              function () {
                frm.call({
                  method: "create_asset_request",
                  freeze: true,
                  freeze_message: "Internet Not Stable, Please Wait...",
                  args: {
                    ticket_id: frm.doc.name,
                    employee_id: frm.doc.employee_id,
                    request_to: request_department,
                  },
                  callback: function (response) {
                    if (response.message && response.message.asset_request_id) {
                      frm.set_value(
                        "asset_request_id",
                        response.message.asset_request_id,
                      );
                      frm.refresh_field("asset_request_id");
                      frm.set_value("ticket_resolved_by", user);
                      frm.set_value("status", "Closed");
                      frm.refresh_field("status");
                      frm.set_value(
                        "close_remark",
                        `Created Asset Request - ${response.message.asset_request_id}`,
                      );
                      frm.save();
                      frappe.show_alert(
                        {
                          message: __("Asset Request created successfully"),
                          indicator: "green",
                        },
                        5,
                      );
                    } else {
                      frappe.show_alert(
                        {
                          message: __("Please Try Again"),
                          indicator: "red",
                        },
                        5,
                      );
                    }
                  },
                });
              },
            );
          },
        });
      });
    }
  },
  //  custom buttons for assign to with search and bar chart representation[assign to the executive with least tickets pending]
  custom_buttons: function (frm) {
    // Check if user has any role containing "Manager"
    let hasManagerRole = frappe.user_roles.some((role) =>
      role.includes("Manager"),
    );

    if (hasManagerRole) {
      frm.add_custom_button(__("Assign to"), function () {
        let assignedUser = frm.doc.assigned_to || "";
        frappe.call({
          method:
            "sahayog_ticket.sahayog_ticket.doctype.sahayog_ticket.sahayog_ticket.get_it_support_executives",
          args: { filters: JSON.stringify({ dept_name: frm.doc.dept_name }) },
          callback: function (r) {
            if (r.message && r.message.length) {
              // Convert r.message to array of objects for sorting
              let users = r.message.map((u) => {
                let match = u[1].match(/^(.*) \((\d+) tickets assigned\)$/);
                let name = match ? match[1].trim() : u[1];
                let count = match ? parseInt(match[2], 10) : 0;
                return { id: u[0], label: u[1], name: name, count: count };
              });

              // Sort: assigned user first, then ascending ticket count
              users.sort((a, b) => {
                if (a.id === assignedUser && b.id !== assignedUser) return -1;
                if (b.id === assignedUser && a.id !== assignedUser) return 1;
                return a.count - b.count;
              });

              // Calculate max count for scaling bars
              let maxCount = Math.max(...users.map((u) => u.count));

              // Build HTML header
              let html = `<div style="display:flex; font-weight:700; font-size:13px; color:#087b74; padding-left:29px; background:#e3f3f3; border-radius:11px 11px 0 0; border:1.5px solid #e0e3e7; margin-bottom:2px;">
                          <div style="width:32px; padding-right:54px;">#</div>
                          <div style="flex:1;">Executive</div>
                          <div style="width:110px; text-align:right; padding-right:53px;">Pending</div>
                        </div>`;

              // Build rows
              let index = 1;
              users.forEach((u) => {
                let barWidth = maxCount ? (u.count / maxCount) * 60 : 0;
                let isAssigned = u.id === assignedUser;

                html += `<div style="
                        display:flex; align-items:center; background:#f3f6f9; border-radius:0 0 11px 11px; 
                        border:1.5px solid #e0e3e7; margin:2px 0 10px 0; padding:0 18px;">
                        <div style="width:32px; text-align:center; color:#6c757d; font-size:12px; font-weight:600; margin-right:10px;">
                          ${index++}
                        </div>
                        <input type="radio" name="assigned_to" value="${
                          u.id
                        }" ${
                          isAssigned ? "checked" : ""
                        } style="margin-right:15px; accent-color:#087b74; width:18px;height:18px;">
                        <span style="flex:1; color:#087b74; font-size:12px; font-weight:600; display:flex; align-items:center;">
                          ${u.name}
                          ${
                            isAssigned
                              ? `<span style="background:#ff8f00; color:#fff; font-size:10px; padding:2px 6px; border-radius:8px; margin-left:10px;">Assigned</span>`
                              : ""
                          }
                        </span>
                        <span style="
                          width:110px; text-align:right;
                          display:flex; justify-content:flex-end; align-items:center;
                          background:#e3f3f3;color:#107561;
                          border-radius:10px; padding:0 15px;
                          font-size:15px; font-weight:600; border:1.2px solid #c0ebe9;">
                          ${u.count}
                          <span style="
                            display:inline-block; height:7px; border-radius:4px;
                            width:${barWidth}px; background:#2cbfae; margin-left:9px; transition:width .3s;">
                          </span>
                          <span style="font-weight:400; font-size:13px; color:#43786d; margin-left:4px;">Tickets</span>
                        </span>
                      </div>`;
              });

              let d = new frappe.ui.Dialog({
                title: __("Select Executive to Assign ticket"),
                fields: [
                  {
                    fieldtype: "HTML",
                    fieldname: "search_input",
                    options: `<input type="text" id="exec_search" placeholder="Search executives..." style="width: 100%; padding: 6px 8px; margin-bottom: 8px; font-size: 14px;">`,
                  },
                  {
                    fieldtype: "HTML",
                    fieldname: "user_html",
                    options: `<div id="exec_list_wrapper" style="max-height: 300px; overflow-y: auto;">${html}</div>`,
                  },
                ],
                primary_action_label: __("Assign"),
                primary_action: function () {
                  // Scope selection to dialog to avoid clashes with other dialogs/pages
                  let selected = d.$wrapper
                    .find("input[name='assigned_to']:checked")
                    .val();
                  if (!selected) {
                    frappe.msgprint(__("Please select a user."));
                    return;
                  }

                  // Set and save, then refresh the form once save completes
                  frm.set_value("assigned_to", selected);
                  frm.save().then(() => {
                    d.hide();
                    // Refresh current document instead of a full page reload
                    try {
                      frm.reload_doc();
                    } catch (e) {
                      // fallback to full reload if reload_doc isn't available
                      location.reload();
                    }
                  });
                },
              });

              // Show the dialog
              d.show();

              // Add search functionality scoped to the dialog wrapper to avoid global handlers
              d.$wrapper.on("input", "#exec_search", function () {
                let query = $(this).val().toLowerCase();
                d.$wrapper.find("#exec_list_wrapper > div").each(function () {
                  let text = $(this).text().toLowerCase();
                  $(this).toggle(text.indexOf(query) !== -1);
                });
              });
            }
          },
        });
      });
    } else {
    }
  },

  common_hidden_fields: function (frm) {
    frm.toggle_display("status", false);
    frm.toggle_display("assigned_it", false);
  },

  hide_timeline: function (frm) {
    const hasSystemManagerRole = frappe.user_roles.includes("System Manager");
    let timeline_items = frm.timeline.wrapper.find(".timeline-item");

    timeline_items.each(function () {
      let item = $(this);
      let itemText = item.text();

      if (
        !hasSystemManagerRole &&
        (itemText.includes("OTP") ||
          itemText.includes("New Email") ||
          itemText.includes("Notification sent to"))
      ) {
        item.hide();
      }
    });
  },

  Employee_hidden_fields: function (frm) {
    frm.trigger("common_hidden_fields");
    let user = frappe.session.user;
    let employee_user = frm.doc.employee_user_id;

    if (user == employee_user) {
    }
  },

  it_support_manager_fields_show: function (frm) {
    if (frappe.user.has_role("IT Support Manager")) {
      frm.toggle_display("assigned_it", true);
    }
  },

  // assign to button with user fetch from server side based on department & roles
  assign_to_button: function (frm) {
    frm.add_custom_button(__("Assign to"), async function () {
      if (!frm.doc.dept_name) {
        frappe.msgprint(__("Please select a Department first."));
        return;
      }

      // Get matching users from server
      frm.call({
        method: "get_users_by_departsection_roles",
        args: {
          departsection: frm.doc.dept_name,
        },
        callback: function (r) {
          if (r.message && r.message.length > 0) {
            frappe.prompt(
              {
                label: __("Assign to"),
                fieldname: "assigned_to",
                fieldtype: "Link",
                options: "User",
                reqd: 1,
                get_query: () => {
                  return {
                    filters: {
                      name: ["in", r.message], // r.message is an array of user emails
                    },
                  };
                },
              },
              function (values) {
                if (values.assigned_to) {
                  frm.set_value("assigned_to", values.assigned_to);

                  frm.save();
                } else {
                  frappe.msgprint(__("Please select a user to assign."));
                }
              },
            );
          } else {
            frappe.msgprint(__("No eligible users found for this department."));
          }
        },
      });
    });
  },

  // in progress button with remark dialog box :it will set the status to in progress with executive remark
  In_Progress_button: function (frm) {
    frm.add_custom_button(
      __("In-Progress"),
      function () {
        let currentOnHoldRemark = frm.doc.on_hold_remark || "";

        frappe.confirm(__("Do you want to set In-Progress "), function () {
          let d = new frappe.ui.Dialog({
            title: "Enter In-Progress Remarks",
            fields: [
              {
                label: "In-Progress Remark",
                fieldname: "executive_remark",
                fieldtype: "Small Text",
                reqd: 1,
                default: currentOnHoldRemark,
              },
            ],
            size: "small",
            primary_action_label: "Submit",
            primary_action: function () {
              if (!d.fields_dict.executive_remark.get_value()) {
                frappe.msgprint(__("Please provide In-Progress remark."));
                return;
              }

              frm.set_value(
                "executive_remark",
                d.fields_dict.executive_remark.get_value(),
              );
              frm.set_value("status", "In-Progress");
              frm.refresh_field("status");
              frm.set_value("assigned_to", frappe.session.user);
              frm.save();
              d.hide();
            },
          });
          d.show();
        });
      },
      __("Status"),
    );
  },

  // below function is for resolve button with remark dialog box : it will set the status to resolved with resolved remark
  resolve_button: function (frm) {
    frm.add_custom_button(
      __("Resolve"),
      function () {
        let user = frappe.session.user;
        frappe.confirm(__("Do you want to Resolve the Ticket "), function () {
          let d = new frappe.ui.Dialog({
            title: "Enter Resolve Remark",
            fields: [
              {
                label: "Resolve Remark",
                fieldname: "resolved_remark",
                fieldtype: "Small Text",
                reqd: 1,
              },
            ],
            size: "small",
            primary_action_label: "Submit",
            primary_action: function () {
              if (!d.fields_dict.resolved_remark.get_value()) {
                frappe.msgprint(__("Please provide Resolve remark."));
                return;
              }

              frm.set_value(
                "resolved_remark",
                d.fields_dict.resolved_remark.get_value(),
              );
              frm.set_value("status", "Resolved");
              frm.refresh_field("status");
              frm.set_value("ticket_resolved_by", user);
              frm.set_value(
                "ticket_resolved_on",
                frappe.datetime.now_datetime(),
              );
              frm.set_value("assigned_to", user);
              frm.save();
              d.hide();
            },
          });
          d.show();
        });
      },
      __("Status"),
    );
  },

  // below function is for reopen button with remark dialog box : it will set the status to open with reopen remark
  reopen_button: function (frm) {
    frm
      .add_custom_button(__("Re-Open"), function () {
        frappe.confirm(__("Do you want to Re-Open the Ticket?"), function () {
          const d = new frappe.ui.Dialog({
            title: __("Enter Re-Open Remark"),
            fields: [
              {
                label: "Re-Open Remark",
                fieldname: "reopen_remark",
                fieldtype: "Small Text",
                reqd: 1,
              },
            ],
            primary_action_label: __("Submit"),
            primary_action: function () {
              const values = d.get_values();
              if (!values) return;

              frm.set_value("reopen_remark", values.reopen_remark);
              frm.set_value("status", "Open");
              frm.refresh_field("status");
              frm.set_value("ticket_resolved_by", "");
              frm.set_value("ticket_resolved_user", "");
              frm.set_value("ticket_resolved_on", "");
              frm.save().then(() => {
                frappe.msgprint(__("Ticket has been re-opened."));
              });
              d.hide();
            },
          });
          d.show();
        });
      })
      .css({
        "background-color": "#FFA500",
        color: "white",
        "border-color": "#FF8C00",
      });
  },

  // below function is for close button with remark dialog box : it will set the status to closed with close remark
  close_button: function (frm) {
    frm
      .add_custom_button(__("Close"), function () {
        frappe.confirm(
          __(
            "Do you want to Close the Ticket? Once it is closed, it cannot be re-opened.",
          ),
          function () {
            const d = new frappe.ui.Dialog({
              title: __("Enter Close Remark"),
              fields: [
                {
                  label: "Close Remark",
                  fieldname: "close_remark",
                  fieldtype: "Small Text",
                  reqd: 1,
                },
              ],
              primary_action_label: __("Submit"),
              primary_action: function () {
                const values = d.get_values();
                if (!values) return;

                frm.set_value("close_remark", values.close_remark);
                frm.set_value("status", "Closed");
                frm.refresh_field("status");
                frm.save();
                d.hide();
              },
            });
            d.show();
          },
        );
      })
      .css({
        "background-color": "#DC143C",
        color: "white",
        "border-color": "#B22222",
      });
  },

  // below function is for executive remark button with remark dialog box : it will set the executive remark field
  executive_remark: function (frm) {
    frm.add_custom_button(
      __("Set Executive Remark"),
      function () {
        let currentRemark = frm.doc.executive_remark || "";

        let d = new frappe.ui.Dialog({
          title: "Executive Remark",
          fields: [
            {
              label: "Executive Remark",
              fieldname: "executive_remark",
              fieldtype: "Small Text",
              reqd: 1,
              default: currentRemark,
            },
          ],
          primary_action_label: "Save",
          primary_action: function () {
            let remark = d.get_value("executive_remark");

            if (!remark) {
              frappe.msgprint(__("Please enter the Executive Remark."));
              return;
            }

            frm.set_value("executive_remark", remark);
            frm.save();
            d.hide();
          },
        });

        d.show();
      },
      __("Actions"),
    );
  },

  // below function is for reset user password button with dialog box : it will allow manager or executive to reset password of any user
  // by entering user id usiing server side method
  reset_user_password: function (frm) {
    let hasManagerRole = frappe.user_roles.some(
      (role) =>
        role.toLowerCase().includes("manager") ||
        role.toLowerCase().includes("executive"),
    );

    if (hasManagerRole) {
      frm.add_custom_button(
        __("Reset User Password"),
        function () {
          let d = new frappe.ui.Dialog({
            title: __("Reset User Password"),
            fields: [
              {
                fieldtype: "Data",
                label: "User ID",
                fieldname: "user_id",
                reqd: 1,
              },
              {
                fieldtype: "Section Break",
              },
              {
                fieldtype: "HTML",
                fieldname: "user_info_html",
              },
            ],
            primary_action_label: __("Check"),
            primary_action(values) {
              if (!values.user_id) {
                frappe.msgprint(__("Please enter a User ID."));
                return;
              }

              frappe.call({
                method:
                  "sahayog_ticket.sahayog_ticket.doctype.sahayog_ticket.sahayog_ticket.get_user_details",
                args: { username: values.user_id },
                callback: function (r) {
                  if (r.message) {
                    // Show user info
                    d.set_value(
                      "user_info_html",
                      `<b>Full Name:</b> ${r.message.full_name}<br/>
                   <b>USER ID:</b> ${r.message.email}`,
                    );

                    // Change button to Reset Password
                    d.set_primary_action(
                      __("Reset Password"),
                      function (values) {
                        if (!values.user_id) {
                          frappe.msgprint(__("Please enter a new password."));
                          return;
                        }
                        frappe.call({
                          method:
                            "sahayog_ticket.sahayog_ticket.doctype.sahayog_ticket.sahayog_ticket.reset_user_password",
                          args: {
                            email: r.message.email,
                            new_password: values.user_id,
                          },
                          callback: function (res) {
                            if (
                              res.message &&
                              res.message.message === "success"
                            ) {
                              frappe.show_alert(
                                __(
                                  "Password reset successfully for " +
                                    r.message.full_name,
                                ),
                              );
                              d.hide();
                            } else {
                              frappe.msgprint(
                                __(
                                  "Failed to reset password. Please try again.",
                                ),
                              );
                            }
                          },
                        });
                      },
                    );
                  } else {
                    // If user not found
                    d.set_value(
                      "user_info_html",
                      `<span style="color:red;">User not found.</span>`,
                    );
                    d.get_field("new_password").$wrapper.hide();
                    d.set_primary_action(__("Check"), d.primary_action);
                  }
                },
              });
            },
          });

          // Hide password field initially after dialog is rendered
          d.on_page_show = () => {
            d.get_field("new_password").$wrapper.hide();
          };

          // For older Frappe versions, use a timeout as fallback
          setTimeout(() => {
            d.get_field("new_password").$wrapper.hide();
          }, 300);

          d.show();
        },
        __("Actions"),
      );
    }
  },

  // hide sidebar options for non system manager users
  hide_sidebar_options(frm) {
    if (!frappe.user.has_role("System Manager")) {
      $(".form-assignments").hide();
      //$(".form-attachments").hide();
      $(".form-shared").hide();
      $(".form-tags").hide();
      //$(".form-sidebar-stats").hide();
      //$(".list-unstyled.sidebar-menu.text-muted").hide();
    }
  },

  // function to hide additional details from timeline for non system manager users hide details like OTP ,
  // email notification , viewed this etc
  hide_additional_details_from_timeline: function (frm) {
    const printButton = document.querySelector(
      'button[data-original-title="Print"]',
    );
    if (printButton) {
      printButton.style.display = "none";
    }

    // Hide the menu button
    const menuButton = document.querySelector(
      'button[data-original-title="Menu"]',
    );
    if (menuButton) {
      menuButton.style.display = "none";
    }
    // Check if the user has the "System Manager" role
    const hasSystemManagerRole = frappe.user_roles.includes("System Manager");

    // Get all timeline items
    let timeline_items = frm.timeline.wrapper.find(".timeline-item");

    // Iterate through timeline items and hide entries based on conditions
    timeline_items.each(function () {
      let item = $(this);
      let text = item.text();

      // Hide entries containing 'OTP' if the user is not a System Manager
      if (text.includes("OTP") && !hasSystemManagerRole) {
        item.hide();
      }

      // Hide entries containing 'Notification sent to'
      if (text.includes("Notification sent to") && !hasSystemManagerRole) {
        item.hide();
      }

      // Hide entries containing 'New Email'
      if (text.includes("New Email") && !hasSystemManagerRole) {
        item.hide();
      }

      // Hide entries containing 'viewed this'
      if (text.includes("viewed this") && !hasSystemManagerRole) {
        item.hide();
      }

      // Hide entries containing 'viewed this'
      if (text.includes("added rows") && !hasSystemManagerRole) {
        item.hide();
      }

      if (text.includes("last edited this") && !hasSystemManagerRole) {
        item.hide();
      }

      if (text.includes("created this") && !hasSystemManagerRole) {
        item.hide();
      }

      if (
        text.includes("changed the value of Employee Name from") &&
        !hasSystemManagerRole
      ) {
        item.hide();
      }

      if (text.includes("Notification sent") && !hasSystemManagerRole) {
        item.hide();
      }

      if (text.includes("added rows for Status Log") && !hasSystemManagerRole) {
        item.hide();
      }

      if (
        text.includes("Impersonated by ADMINISTRATOR") &&
        !hasSystemManagerRole
      ) {
        item.hide();
      }

      if (text.includes("added rows for Status Log") && !hasSystemManagerRole) {
        item.hide();
      }
    });
  },
});

//  iniate Notify Branch Button[send email to branch and employee get email data from employee doctype & sahayog branch doctype]
function setup_notify_branch_button(frm) {
  if (frm.is_new()) return;
  if (frm.is_disabled) return;

  frm.remove_custom_button(__("Reply to Ticket"));

  frappe.db
    .get_value("Employee", { user_id: frm.doc.owner }, [
      "branch",
      "company_email",
      "name",
    ])
    .then(async (r) => {
      if (!r.message) return;

      const emp_branch = r.message.branch || "";
      const emp_email = r.message.company_email || "";
      const emp_id = r.message.name || "";

      frm.add_custom_button(__("Reply to Ticket"), async () => {
        const d = new frappe.ui.Dialog({
          title: __("Reply via Email"),
          fields: [
            {
              fieldname: "use_employee",
              fieldtype: "Check",
              label: __("Send to Employee Email"),
            },
            {
              fieldname: "use_branch",
              fieldtype: "Check",
              label: __("Send to Branch Email"),
            },

            {
              fieldname: "employee_id",
              fieldtype: "Data",
              label: __("Employee ID"),
              read_only: 1,
              hidden: 1,
            },
            {
              fieldname: "employee_email",
              fieldtype: "Data",
              label: __("Employee Email"),
              hidden: 1,
            },

            {
              fieldname: "branch_name",
              fieldtype: "Data",
              label: __("Branch"),
              read_only: 1,
              hidden: 1,
            },
            {
              fieldname: "branch_email",
              fieldtype: "Data",
              label: __("Branch Email"),
              hidden: 1,
            },

            {
              fieldname: "comment",
              fieldtype: "Small Text",
              label: __("Comment"),
              reqd: 1,
            },
          ],

          primary_action_label: __("Send"),
          async primary_action(values) {
            const recipients = [];

            // 🔹 EMPLOYEE → manual ONLY if email NOT in master
            if (values.use_employee && !emp_email && values.employee_email) {
              recipients.push(values.employee_email);
            }

            // 🔹 BRANCH → always manual
            if (values.use_branch && values.branch_email) {
              recipients.push(values.branch_email);
            }

            // ✅ ALWAYS CREATE COMMENT
            await frappe.call({
              method: "frappe.desk.form.utils.add_comment",
              args: {
                reference_doctype: frm.doctype,
                reference_name: frm.docname,
                content: values.comment,
                comment_by: frappe.session.user,
                comment_email: frappe.session.user,
              },
            });

            // Refresh History
            if($(".chatbot-floating-window").is(":visible")) {
                frm.trigger("render_floating_chat_content");
            }

            // ✅ SEND MANUAL EMAIL ONLY IF NEEDED
            if (recipients.length) {
              await frappe.call({
                method:
                  "sahayog.sahayog.api.comment_email.send_manual_ticket_notification",
                args: {
                  reference_name: frm.docname,
                  comment: values.comment,
                  recipient_emails: recipients,
                },
              });
            }

            d.hide();
            frappe.show_alert(
              { message: __("Reply added successfully"), indicator: "green" },
              5,
            );
          },
        });

        /* ================= EMPLOYEE PREFILL ================= */
        if (emp_email) {
          d.set_value("use_employee", 1);
          d.set_df_property("employee_id", "hidden", 0);
          d.set_df_property("employee_email", "hidden", 0);

          d.set_value("employee_id", emp_id);
          d.set_value("employee_email", emp_email);
          d.set_df_property("employee_email", "read_only", 1);
        }

        /* ================= BRANCH PREFILL ================= */
        let branch_email = "";
        let branch_name = "";

        if (emp_branch) {
          const key = emp_branch.toLowerCase().replace("branch", "").trim();

          const res = await frappe.call({
            method: "frappe.client.get_list",
            args: {
              doctype: "Sahayog Branch",
              fields: ["branch", "email"],
              filters: [["branch", "like", `%${key}%`]],
              limit_page_length: 1,
            },
          });

          if (res.message?.length) {
            branch_name = res.message[0].branch;
            branch_email = res.message[0].email || "";
          }
        }

        if (branch_email) {
          d.set_value("use_branch", 1);
          d.set_df_property("branch_name", "hidden", 0);
          d.set_df_property("branch_email", "hidden", 0);

          d.set_value("branch_name", branch_name);
          d.set_value("branch_email", branch_email);
          d.set_df_property("branch_email", "read_only", 1);
        }

        /* ================= TOGGLES ================= */
        d.fields_dict.use_employee.df.onchange = () => {
          const on = d.get_value("use_employee");
          d.set_df_property("employee_id", "hidden", !on);
          d.set_df_property("employee_email", "hidden", !on);

          if (on) {
            d.set_value("employee_id", emp_id || frm.doc.owner);
          }
          d.refresh();
        };

        d.fields_dict.use_branch.df.onchange = () => {
          const on = d.get_value("use_branch");
          d.set_df_property("branch_name", "hidden", !on);
          d.set_df_property("branch_email", "hidden", !on);
          d.refresh();
        };

        d.show();
      });
    });
}

// SAHAYOG TICKET INTRO RENDERING
function render_safe_intro_always_visible(frm) {
  if (!frm || !frm.doc || frm.__intro_shown || !frm.doc.employee_id) {
    return;
  }

  frm.__intro_shown = true;

  // ✅ REST API - Direct Employee Doctype query (WORKS EVERYWHERE)
  frappe.call({
    method: "frappe.client.get",
    args: {
      doctype: "Employee",
      filters: { employee_number: frm.doc.employee_id }, // Standard Employee field
    },
    freeze: false,
    callback: function (r) {
      if (r.message) {
        let data = r.message;

        // ✅ REAL EMPLOYEE FIELDS (standard Employee doctype)
        const emp_id = frm.doc.employee_id || "N/A";
        const full_name = data.employee_name || "Not specified";
        const emp_designation = data.designation || "Not specified";
        const emp_branch = data.branch || "Not specified";
        const emp_department = data.department || "Not specified";
        const emp_phone = data.cell_number || data.phone || "Not available";
        const emp_division = data.custom_division || "Not available";
        const emp_email = data.company_email || "Not available";

        // ✅ TICKET DATA (unchanged)
        const ticket_department = frm.doc.dept_name || "Not specified";
        const ticket_type = frm.doc.ticket_type || "Not specified";
        const ticket_tat = frm.doc.tat || "N/A";
        const is_resolved_or_closed = ["Resolved", "Closed"].includes(
          frm.doc.status || "",
        );
        const ticket_assigned_label = is_resolved_or_closed
          ? "Resolved by:"
          : "Assigned to:";
        let ticket_assigned_to = is_resolved_or_closed
          ? frm.doc.ticket_resolved_user || ""
          : frm.doc.assigned_to_name || "";

        if (!ticket_assigned_to) {
          ticket_assigned_to = "Executive will be assigned shortly.";
        }

        // ✅ YOUR EXACT SAME DESIGN
        const intro_html = `
          <div id="custom-ticket-intro" style="margin:20px 0">
            <div style="display:flex;align-items:center;padding:15px;background:var(--card-bg,#ededed);border-radius:8px;color:#006767;border:1px solid var(--border-color,#d3d3d3)">
              <img src="/assets/sahayog_ticket/images/profile.png"
                  style="width:60px;height:60px;border-radius:50%;margin-right:15px" />
              <div>
                <div style="font-size:16px;font-weight:bold">
                  ${full_name} - ${emp_id}
                </div>
                <div style="font-size:13px">
                  ${emp_designation}, ${emp_department}, ${emp_branch}, ${emp_division}<br>
                  Phone : ${emp_phone}, Email : ${emp_email}
                </div>
              </div>
            </div>

            <div style="margin-top:1px;border:1px solid var(--border-color,#d3d3d3);padding:10px;border-radius:6px;background:var(--card-bg,#ededed);font-family:Courier New">
              <div style="display:flex;flex-wrap:wrap;gap:20px;font-size:13px">
                <div><strong>Request To:</strong> ${ticket_department}</div>
                <div><strong>Issue:</strong> ${ticket_type}</div>
                <div><strong>TAT:</strong> ${ticket_tat}</div>
              </div>
              <div style="margin-top:8px">
                <strong>${ticket_assigned_label}</strong> 
                <span style="background:var(--control-bg,rgba(0,103,103,0.1));padding:4px 8px;border-radius:4px">${ticket_assigned_to}</span>
              </div>
            </div>
          </div>
        `;

        insert_intro_perfectly(intro_html);
      } else {
        render_safe_intro_fallback(frm);
      }
    },
    error: function () {
      render_safe_intro_fallback(frm);
    },
  });
}
// ✅ YOUR ORIGINAL FALLBACK (form data)
function render_safe_intro_fallback(frm) {
  const emp_id = frm.doc.employee_id || "N/A";
  const full_name =
    [frm.doc.emp_first_name, frm.doc.emp_last_name].filter(Boolean).join(" ") ||
    "Not specified";
  const emp_designation = frm.doc.designation || "Not specified";
  const emp_branch = frm.doc.branch_name || "Not specified";
  const emp_department = frm.doc.emp_department || "Not specified";
  const emp_phone = frm.doc.phone1 || "Not available";
  const emp_division = frm.doc.division || "Not available";
  const emp_email = frm.doc.company_email || "Not available";

  const ticket_department = frm.doc.dept_name || "Not specified";
  const ticket_type = frm.doc.ticket_type || "Not specified";
  const ticket_tat = frm.doc.tat || "N/A";
  const is_resolved_or_closed = ["Resolved", "Closed"].includes(
    frm.doc.status || "",
  );
  const ticket_assigned_label = is_resolved_or_closed
    ? "Resolved by:"
    : "Assigned to:";
  let ticket_assigned_to = is_resolved_or_closed
    ? frm.doc.ticket_resolved_user || ""
    : frm.doc.assigned_to_name || "";

  if (!ticket_assigned_to) {
    ticket_assigned_to = "Executive will be assigned shortly.";
  }

  const intro_html = `
    <div id="custom-ticket-intro" style="margin:20px 0">
      <div style="display:flex;align-items:center;padding:15px;background:var(--card-bg,#ededed);border-radius:8px;color:#006767;border:1px solid var(--border-color,#d3d3d3)">
        <img src="/assets/sahayog_ticket/images/profile.png"
            style="width:60px;height:60px;border-radius:50%;margin-right:15px" />
        <div>
          <div style="font-size:16px;font-weight:bold">
            ${full_name} - ${emp_id}
          </div>
          <div style="font-size:13px">
            ${emp_designation}, ${emp_department}, ${emp_branch}, ${emp_division}<br>
            Phone : ${emp_phone}, Email : ${emp_email}
          </div>
        </div>
      </div>
      <div style="margin-top:1px;border:1px solid var(--border-color,#d3d3d3);padding:10px;border-radius:6px;background:var(--card-bg,#ededed);font-family:Courier New">
        <div style="display:flex;flex-wrap:wrap;gap:20px;font-size:13px">
          <div><strong>Request To:</strong> ${ticket_department}</div>
          <div><strong>Issue:</strong> ${ticket_type}</div>
          <div><strong>TAT:</strong> ${ticket_tat}</div>
        </div>
        <div style="margin-top:8px">
          <strong>${ticket_assigned_label}</strong> 
          <span style="background:var(--control-bg,rgba(0,103,103,0.1));padding:4px 8px;border-radius:4px">${ticket_assigned_to}</span>
        </div>
      </div>
    </div>
  `;

  insert_intro_perfectly(intro_html);
}

function insert_intro_perfectly(html) {
  // ✅ CLEAN FIRST
  $("#custom-ticket-intro").remove();

  // ✅ MOST RELIABLE TARGETS
  const targets = [
    $(".form-wrapper").first(),
    $(".layout-wrapper").first(),
    $(".form-body").first(),
    $(".form-layout").first(),
    $(".page-content").first(),
    $("form").first(),
  ];

  let inserted = false;
  for (let target of targets) {
    if (target.length) {
      target.prepend(html);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    $("body").prepend(html);
  }

  // ✅ FORCE VISIBILITY
  setTimeout(() => {
    const intro = $("#custom-ticket-intro");
    if (intro.length) {
      intro
        .css({
          display: "block !important",
          visibility: "visible !important",
          opacity: "1 !important",
          position: "relative !important",
          "z-index": "9999 !important",
        })
        .show();
    } else {
    }
  }, 200);
}
// introZ

// --- end of sahayog_ticket.js ---

// start of ticket_item.js we are adding a button to fetch account details from external API
frappe.ui.form.on("Ticket Item", {
  get_account_details: function (frm, cdt, cdn) {
    let row = frappe.get_doc(cdt, cdn);

    if (!row.account_number) {
      frappe.msgprint({
        title: __("Validation Error"),
        message: __("Please enter Account Number first."),
        indicator: "red",
      });
      return;
    }

    frappe.call({
      method:
        "sahayog_ticket.sahayog_ticket.doctype.sahayog_ticket.account_api.get_account_details",
      args: {
        account_number: row.account_number,
      },
      freeze: true,
      freeze_message: __("Fetching Account Details..."),

      callback: function (r) {
        if (r.message) {
          // Update only UI fields (Not DB)
          frappe.model.set_value(cdt, cdn, "cif", r.message.cif);
          frappe.model.set_value(
            cdt,
            cdn,
            "customer_name",
            r.message.customer_name,
          );
          let contact_number = r.message.contact_number || "";
          // Strip +91 prefix if present
          if (contact_number.startsWith("+91")) {
            contact_number = contact_number.substring(3);
          }
          frappe.model.set_value(cdt, cdn, "contact_number", contact_number);
          frappe.model.set_value(
            cdt,
            cdn,
            "account_type",
            r.message.account_type,
          );
          frappe.model.set_value(cdt, cdn, "email", r.message.email);

          frm.refresh_field("ticket_items");

          frappe.show_alert({
            message: __("Account details fetched"),
            indicator: "green",
          });
        }
      },
    });
  },
});
