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

    // Check if the user is an employee and has a specific role
    if (frm.doc.status === "Closed") {
      frappe.show_alert("This ticket is closed and cannot be edited.");
      frm.disable_form();
    }

    if (frm.is_new()) {
      console.log("New Form - Set Employee Details");
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
        console.log("User has one of the Support Executive roles");

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
        console.log("Employee");
        if (
          frm.doc.status === "Resolved" &&
          frm.doc.owner === frappe.session.user
        ) {
          console.log(frm.doc.owner);
          frm.trigger("reopen_button");
          frm.trigger("close_button");
        }
      } else {
        if (frappe.user.has_role("CTO")) {
          console.log("CTO");
          frm.disable_save();
          frm.disable_form();
        } else {
          console.log("Not Employee");
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
      console.log("stationery");
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

    // 1. Clean existing elements
    $(".chatbot-wrapper-global").remove();

    // 2. Global Wrapper
    let html = `
        <div class="chatbot-wrapper-global" style="
            position: fixed; bottom: 20px; right: 20px; z-index: 9999;
            display: flex; flex-direction: column; align-items: flex-end;
            font-family: 'Inter', sans-serif;
        ">
            <!-- Floating History Window -->
            <div class="chatbot-floating-window" style="
                width: 320px; height: 380px; background: white; border-radius: 16px;
                box-shadow: 0 12px 28px rgba(0,0,0,0.12); margin-bottom: 12px;
                display: none; flex-direction: column; overflow: hidden; border: 1px solid #e0e6ed;
            ">
                <div class="chat-header" style="
                    padding: 10px 15px; background: linear-gradient(135deg, #00b09b, #96c93d);
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
                    flex-direction: column; gap: 4px; background-color: #f8fafc; scroll-behavior: smooth;
                    min-height: 0; overscroll-behavior: contain;
                "></div>
            </div>

            <!-- Bottom Row (Input + Circular FAB) -->
            <div style="display: flex; align-items: flex-end; gap: 10px; width: 100%; justify-content: flex-end;">
                
                <!-- Input Container (Slides out from FAB) -->
                <div class="chat-input-container" style="
                    display: none; background: white; border-radius: 24px;
                    padding: 4px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                    flex-grow: 1; border: 1px solid #e2e8f0; align-items: center;
                    gap: 8px; max-width: 260px;
                ">
                    <button id="chat-attach-dynamic" style="background: none; border: none; color: #94a3b8; font-size: 18px; cursor: pointer;">
                        <i class="fa fa-paperclip"></i>
                    </button>
                    <textarea id="chat-input-dynamic" placeholder="Type a message..." style="
                        flex-grow: 1; border: none; padding: 8px 0; font-size: 13px;
                        outline: none; resize: none; height: 36px; background: transparent;
                        max-height: 100px;
                    "></textarea>
                </div>

                <!-- Circular FAB (Acts as Open Trigger & Send Button) -->
                <div class="chatbot-fab" style="
                    width: 50px; height: 50px; background: linear-gradient(135deg, #00b09b, #96c93d);
                    color: white; border-radius: 50%; display: flex; align-items: center;
                    justify-content: center; font-size: 20px; cursor: pointer;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15); flex-shrink: 0;
                    transition: transform 0.2s;
                ">
                    <i class="fa fa-paper-plane"></i>
                </div>
            </div>
        </div>
    `;

    $("body").append(html);

    let fab = $(".chatbot-fab");
    let win = $(".chatbot-floating-window");
    let input_container = $(".chat-input-container");
    let input = $("#chat-input-dynamic");

    // Unified FAB Action
    fab.on('click', function() {
        if (!win.is(":visible")) {
            // OPEN CHAT
            win.css('display', 'flex').hide().fadeIn(200);
            input_container.css('display', 'flex').hide().fadeIn(200);
            frm.trigger("render_floating_chat_content");
            input.focus();
        } else {
            // SEND MESSAGE
            let message = input.val().trim();
            if (!message) return;

            input.prop('disabled', true);
            fab.css('opacity', '0.5').css('pointer-events', 'none');

            frappe.call({
                method: "frappe.desk.form.utils.add_comment",
                args: {
                    reference_doctype: frm.doctype, reference_name: frm.docname,
                    content: message, comment_by: frappe.session.user, comment_email: frappe.session.user
                },
                callback: function() {
                    input.val('').prop('disabled', false).css('height', '36px');
                    fab.css('opacity', '1').css('pointer-events', 'auto');
                    frm.trigger("render_floating_chat_content");
                    input.focus();
                }
            });
        }
    });

    $(".chat-close-trigger").on('click', () => {
        win.fadeOut(200);
        input_container.fadeOut(200);
    });

    // Enter to Send
    input.on('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fab.click(); }
    });

    // Auto-resize Input
    input.on('input', function() {
        this.style.height = '36px';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Attachment Logic
    $("#chat-attach-dynamic").on('click', function() {
        new frappe.ui.FileUploader({
            doctype: frm.doctype, docname: frm.docname, make_attachments_public: true,
            on_success: () => frm.trigger("render_floating_chat_content")
        });
    });

    // Click Outside to Close
    $(document).on('mousedown.chat_outside', function(e) {
        let wrapper = $(".chatbot-wrapper-global");
        if (win.is(":visible") && !wrapper.is(e.target) && wrapper.has(e.target).length === 0) {
            $(".chat-close-trigger").click();
        }
    });

    // Navigation Cleanup
    frappe.router.on('change', () => {
        if (frappe.get_route()[0] !== 'Form' || frappe.get_route()[1] !== 'Sahayog Ticket') {
            $(".chatbot-wrapper-global").remove();
            $(document).off('mousedown.chat_outside');
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
      },
      callback: function (r) {
        let history = [];
        let senders = new Set();
        if (r.message) {
          r.message.forEach((c) => {
            let content = c.content;
            if (c.comment_type === "Attachment" && content && content.startsWith("/") && !content.includes("<a")) {
              let filename = content.split("/").pop();
              content = `<div style="display:flex; align-items:center; gap:6px; padding:4px; background: rgba(0,176,155,0.05); border-radius:6px;">
                            <div style="width: 24px; height: 24px; background: white; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #00b09b; font-size: 10px;"><i class="fa fa-file"></i></div>
                            <div style="flex:1; overflow: hidden;"><a href="${content}" target="_blank" style="font-weight: 600; color: #1e293b; font-size: 11px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${filename}</a></div>
                         </div>`;
            }
            let sender = c.comment_by || c.owner;
            history.push({ 
              type: c.comment_type, 
              content: content, 
              by: sender, 
              date: c.creation, 
              is_system: c.comment_type === "Info" || c.comment_type === "Attachment" 
            });
            if (sender && sender !== 'Administrator' && sender !== frappe.session.user) senders.add(sender);
          });
        }
        if (frm.doc.status_log) {
          frm.doc.status_log.forEach((log) => {
            if (log.status_remark) {
              history.push({ 
                type: "Status", 
                content: `Status: ${log.from_status} to ${log.to_status}`, 
                by: log.status_change_by, 
                date: log.status_change_on, 
                is_system: true 
              });
              if (log.status_change_by && log.status_change_by !== 'Administrator' && log.status_change_by !== frappe.session.user) senders.add(log.status_change_by);
            }
          });
        }
        history.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Fetch Employee details for senders
        if (senders.size > 0) {
          frappe.call({
            method: "frappe.client.get_list",
            args: {
              doctype: "Employee",
              filters: { user_id: ["in", Array.from(senders)] },
              fields: ["user_id", "employee_name", "name"]
            },
            callback: function(res) {
              let emp_map = {};
              (res.message || []).forEach(e => {
                emp_map[e.user_id] = { name: e.employee_name, id: e.name };
              });
              render_history(history, emp_map);
            }
          });
        } else {
          render_history(history, {});
        }

        function render_history(history, emp_map) {
          chat_history.empty();
          if (history.length === 0) chat_history.append('<p style="text-align:center; color:#94a3b8; font-size:11px; margin-top:10px;">No messages.</p>');
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
              chat_history.append(`<div style="align-self:center; background:#eef2f6; color:#64748b; padding:4px 10px; border-radius:15px; font-size:10px; text-align:center; max-width:90%; margin:2px 0; border:1px solid #dfe5ec;">${item.content}${system_user} ${time}</div>`);
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

              chat_history.append(`
                  <div style="display:flex; gap:6px; flex-direction:${is_me ? 'row-reverse' : 'row'}; align-self:${is_me ? 'flex-end' : 'flex-start'}; max-width:90%; ${!show_sender ? 'margin-top:-2px;' : ''}">
                      <div style="display:flex; flex-direction:column; align-items:${is_me ? 'flex-end' : 'flex-start'};">
                          ${show_sender ? `<div style="font-size:9px; font-weight:600; color:#64748b; margin:0 4px 1px 4px;">${display_name}</div>` : ''}
                          <div style="background:${is_me ? '#00b09b' : 'white'}; color:${is_me ? 'white' : '#1e293b'}; padding:4px 8px; border-radius:${is_me ? '10px 10px 2px 10px' : '10px 10px 10px 2px'}; box-shadow:0 1px 2px rgba(0,0,0,0.05); font-size:11px; line-height:1.4; border:${is_me ? 'none' : '1px solid #e2e8f0'};">
                              <div style="display:flex; flex-direction:row; align-items:flex-end; justify-content:space-between; gap:8px;">
                                  <div style="flex-grow:1; word-break:break-word;">${item.content}</div>
                                  <div style="font-size:8px; opacity:0.7; font-weight:500; white-space:nowrap; align-self:flex-end;">${time}</div>
                              </div>
                          </div>
                      </div>
                  </div>
              `);
            }
          });
          setTimeout(() => {
            chat_history.scrollTop(chat_history[0].scrollHeight);
          }, 100);
        }
      }
    });
  },

  render_comments_and_remarks: function (frm) {
    $(frm.fields_dict.comments_and_remarks.wrapper).hide();
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
    let ticket_owner = frm.doc.owner;
    console.log("Ticket Owner:", ticket_owner);

    if (ticket_owner) {
      frappe.call({
        method: "frappe.client.get_list",
        args: {
          doctype: "Employee",
          filters: {
            user_id: ticket_owner,
          },
          fields: ["name", "employee_number"],
          limit_page_length: 1,
        },
        callback: function (response) {
          if (response.message && response.message.length > 0) {
            let employee = response.message[0];
            frm.set_value("employee_id", employee.employee_number);
            frm.refresh_field("employee_id");
            console.log("Employee Number:", employee.employee_number);
          } else {
            console.log("No Employee found for user:", ticket_owner);
          }
        },
      });
    }
  },

  dept_name: function (frm) {
    console.log("Dept : " + frm.doc.dept_name);
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

  priority: function (frm) {
    console.log("priority : " + frm.doc.priority);
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
                  console.log(
                    "Error creating Asset Request:",
                    response.message,
                  );
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
            console.log("Dept Name for Assigned To:", frm.doc.dept_name);
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
      console.log("User does not have any Manager role.");
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
      console.log("Employee matched for hidden fields");
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
    console.log("❌ Skipped - no employee_id or already shown");
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
        console.log("✅ Employee REST API Data:", data);

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
            <div style="display:flex;align-items:center;padding:15px;background:#ededed;border-radius:8px;color:#006767">
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

            <div style="margin-top:1px;border:1px solid #d3d3d3;padding:10px;border-radius:6px;background:#ededed;font-family:Courier New">
              <div style="display:flex;flex-wrap:wrap;gap:20px;font-size:13px">
                <div><strong>Request To:</strong> ${ticket_department}</div>
                <div><strong>Issue:</strong> ${ticket_type}</div>
                <div><strong>TAT:</strong> ${ticket_tat}</div>
              </div>
              <div style="margin-top:8px">
                <strong>${ticket_assigned_label}</strong> 
                <span style="background:rgba(0,103,103,0.1);padding:4px 8px;border-radius:4px">${ticket_assigned_to}</span>
              </div>
            </div>
          </div>
        `;

        insert_intro_perfectly(intro_html);
        console.log("✅ REST API EMPLOYEE INTRO SHOWN 🎉");
      } else {
        console.log("❌ No employee found - using form fallback");
        render_safe_intro_fallback(frm);
      }
    },
    error: function () {
      console.log("❌ REST API failed - form fallback");
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
      <div style="display:flex;align-items:center;padding:15px;background:#ededed;border-radius:8px;color:#006767">
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
      <div style="margin-top:1px;border:1px solid #d3d3d3;padding:10px;border-radius:6px;background:#ededed;font-family:Courier New">
        <div style="display:flex;flex-wrap:wrap;gap:20px;font-size:13px">
          <div><strong>Request To:</strong> ${ticket_department}</div>
          <div><strong>Issue:</strong> ${ticket_type}</div>
          <div><strong>TAT:</strong> ${ticket_tat}</div>
        </div>
        <div style="margin-top:8px">
          <strong>${ticket_assigned_label}</strong> 
          <span style="background:rgba(0,103,103,0.1);padding:4px 8px;border-radius:4px">${ticket_assigned_to}</span>
        </div>
      </div>
    </div>
  `;

  insert_intro_perfectly(intro_html);
  console.log("✅ FALLBACK INTRO SHOWN");
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
      console.log("✅ INTRO VISIBLE - SUCCESS");
    } else {
      console.log("❌ INTRO NOT FOUND");
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
          frappe.model.set_value(
            cdt,
            cdn,
            "contact_number",
            r.message.contact_number,
          );
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
