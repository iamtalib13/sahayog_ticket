// Copyright (c) 2023, Sid and contributors

frappe.ui.form.on("Sahayog Ticket", {
  refresh: function (frm) {
    frm.trigger("common_hidden_fields");
    frm.trigger("hide_timeline");
    frm.trigger("hide_sidebar_options");
    frm.trigger("custom_buttons");

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
      frm.trigger("set_intro");
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
          frm.trigger("reset_user_password");
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

      // let eid = user.match(/\d+/)[0];
      // console.log("Eid-", eid);
      // let modifiedEmployeeId = "";

      // if (user.includes("ABPS")) {
      //   modifiedEmployeeId = "ABPS" + eid;
      // } else if (user.includes("MCPS")) {
      //   modifiedEmployeeId = "MCPS" + eid;
      // } else if (user.includes("NT")) {
      //   modifiedEmployeeId = "NT" + eid;
      // } else {
      //   modifiedEmployeeId = eid;
      // }

      // if (modifiedEmployeeId === frm.doc.employee_id) {
      //   if (frm.doc.status == "Open") {
      //     frm.set_df_property("cancel_ticket_btn", "hidden", 0);
      //     document.querySelectorAll(
      //       "[data-fieldname='cancel_ticket_btn']"
      //     )[1].style.backgroundColor = "red";
      //     document.querySelectorAll(
      //       "[data-fieldname='cancel_ticket_btn']"
      //     )[1].style.color = "white";
      //     document.querySelectorAll(
      //       "[data-fieldname='cancel_ticket_btn']"
      //     )[1].style.fontWeight = "bold";
      //   }
      //   {
      //     frm.disable_save();
      //   }

      //   frm.toggle_display("employee_id", false);
      //   frm.toggle_display("status", false);
      // } else {
      //   frm.set_df_property("cancel_ticket_btn", "hidden", 1);
      // }
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
  },
  onload: function (frm) {
    if (!frm.is_new()) {
      frm.trigger("set_intro");
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

  set_intro: function (frm) {
    // Refresh-specific logic moved here from second handler
    if (!frm.is_new() && !frm.__intro_shown) {
      frm.__intro_shown = true; // ✅ Set flag to prevent showing again
      frm.call({
        method: "get_employee_info",
        args: {
          employee_number: frm.doc.employee_id,
        },
        callback: function (r) {
          if (r.message) {
            let data = r.message;
            console.log("Employee Data:", data);
            const emp_id = frm.doc.employee_id;
            const full_name = data.employee_name;
            const emp_designation = data.designation || "Not specified";
            const emp_branch = data.branch || "Not specified";
            const emp_department = data.department || "Not specified";
            const emp_phone = data.cell_number || "Not available";
            const emp_division = data.custom_division || "Not available";
            const emp_profile_picture =
              "/assets/sahayog_ticket/images/profile.png";

            const ticket_department = frm.doc.dept_name || "Not specified";
            const ticket_type = frm.doc.ticket_type || "Not specified";
            const ticket_tat = frm.doc.tat || "N/A";

            const is_resolved_or_closed = ["Resolved", "Closed"].includes(
              frm.doc.status
            );
            const ticket_assigned_label = is_resolved_or_closed
              ? "Resolved by:"
              : "Assigned to:";
            let ticket_assigned_to = is_resolved_or_closed
              ? frm.doc.ticket_resolved_user
              : frm.doc.assigned_to_name;

            // ✅ Show fallback message if not assigned
            if (!ticket_assigned_to || ticket_assigned_to.trim() === "") {
              ticket_assigned_to = "Executive will be assigned shortly.";
            }

            const intro_owner = `
        <div class="ticket-employee-card">
          <div class="ticket-employee-photo">
            <img class="ticket-profile-image" src="${emp_profile_picture}" alt="Profile Image" />
          </div>
          <div class="ticket-employee-details">
            <div class="ticket-employee-name-id"><strong>${full_name}</strong> - ${emp_id}</div>
            <div class="ticket-employee-meta">
              ${emp_designation}, ${emp_department}, ${emp_branch}, ${emp_division}<br>
              Phone : ${emp_phone}
            </div>
          </div>
        </div>

        <div class="ticket-terminal">
          <div class="ticket-terminal-info">
            <div class="ticket-info-pair"><strong>Request To:</strong> ${ticket_department}</div>
            <div class="ticket-info-pair"><strong>Issue:</strong> ${ticket_type}</div>
            <div class="ticket-info-pair"><strong>TAT:</strong> ${ticket_tat}</div>
          </div>
          <div class="ticket-terminal-end">
            <span class="ticket-terminal-prompt">${ticket_assigned_label}</span>
            <span class="ticket-terminal-command">${ticket_assigned_to}</span>
          </div>
        </div>

        <style>
          .ticket-employee-card {
            display: flex;
            align-items: center;
            padding: 15px;
            background-color: #ededed;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            color: #006767;
          }

          .ticket-employee-photo {
            margin-right: 15px;
          }

          .ticket-profile-image {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            object-fit: cover;
          }

          .ticket-employee-details {
            display: flex;
            flex-direction: column;
          }

          .ticket-employee-name-id {
            font-size: 16px;
            margin-bottom: 4px;
            font-weight: bold;
            color: #006767;
            margin-bottom: -4px;
          }

          .ticket-employee-meta {
            font-size: 13px;
            color: #006767;
          }

          .ticket-terminal {
            border: 1px solid #d3d3d3;
            background-color: #ededed;
            color: #006767;
            padding: 10px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            margin-top: 8px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .ticket-terminal-info {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            font-family: Arial, sans-serif;
            font-size: 13px;
            color: #006767;
            margin-bottom: 6px;
          }

          .ticket-info-pair {
            display: flex;
            gap: 4px;
            align-items: center;
          }

          .ticket-terminal-prompt {
            color: #006767;
            margin-right: 8px;
            font-weight: bold;
          }

          .ticket-terminal-command {
            color: #006767;
          }

          @media (max-width: 768px) {
            .ticket-employee-card {
              flex-direction: column;
              text-align: center;
            }

            .ticket-terminal {
              font-size: 13px;
            }

            .ticket-terminal-info {
              flex-direction: column;
              gap: 4px;
            }
          }
        </style>
      `;

            frm.set_intro(intro_owner);

            var formMessage = document.querySelector(".form-message.blue");
            if (formMessage) {
              formMessage.style.background = "#ededed";
              formMessage.style.padding = "0";
              formMessage.style.color = "#006767";
            }
          } else {
            frm.set_intro("Employee information not available", "red");
            console.error("[ERROR] No employee data found");
          }
        },
      });
    } else {
      frm.__intro_shown = false;
    }
  },

  // after_save: function (frm) {
  //   let user = frappe.session.user;
  //   let match = user.match(/\d+/);
  //   let eid = match ? match[0] : null;

  //   if (eid === frm.doc.employee_id) {
  //     if (frm.doc.status == "Open") {
  //       var dept = frm.doc.dept_name;
  //       msgprint("Ticket is Saved Successfully.");
  //       msgprint(dept + " Team will Contact You Shortly");
  //       frappe.set_route("List", "Sahayog Ticket", { status: "Open" });
  //     }
  //   }

  //   if (frm.doc.status == "Closed") {
  //     frm.set_df_property("status", "read_only", 1);
  //     frm.set_df_property("assigned_it", "read_only", 1);
  //     frm.set_df_property("close_remark", "read_only", 1);
  //     msgprint("Ticket is Closed Successfully . .");
  //     frm.disable_save();
  //   }

  //   if (frm.doc.cancel_ticket == "Cancel Ticket") {
  //     frm.set_df_property("status", "read_only", 1);
  //     frm.set_df_property("assigned_it", "read_only", 1);
  //     msgprint("Ticket is Cancelled Successfully . .");
  //     frm.disable_save();
  //   }
  // },

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
                emp_name: frm.doc.employee_name,
                designation: frm.doc.designation,
                department: frm.doc.emp_department,
                region: frm.doc.region,
                district: frm.doc.district,
                branch: frm.doc.branch_name,
                request_to: request_department,
                phone: frm.doc.phone1,
                division: frm.doc.division,
              },
              callback: function (response) {
                if (response.message && response.message.asset_request_id) {
                  frm.set_value(
                    "asset_request_id",
                    response.message.asset_request_id
                  );
                  frm.refresh_field("asset_request_id");
                  frm.set_value("ticket_resolved_by", user);
                  frm.set_value("status", "Closed");
                  frm.refresh_field("status");
                  frm.set_value(
                    "close_remark",
                    `Created Asset Request - ${response.message.asset_request_id}`
                  );
                  frm.save();
                  frappe.show_alert(
                    {
                      message: __("Asset Request created successfully"),
                      indicator: "green",
                    },
                    5
                  );
                } else {
                  console.log(
                    "Error creating Asset Request:",
                    response.message
                  );
                  frappe.show_alert(
                    {
                      message: __("Please Try Again"),
                      indicator: "red",
                    },
                    5
                  );
                }
              },
            });
          }
        );
      });
    }
  },
  custom_buttons: function (frm) {
    // Check if user has any role containing "Manager"
    let hasManagerRole = frappe.user_roles.some((role) =>
      role.includes("Manager")
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

  // cancel_ticket_btn: function (frm) {
  //   if (!frm.is_new()) {
  //     let user = frappe.session.user;
  //     let eid = user.match(/\d+/)[0];

  //     if (eid === frm.doc.employee_id) {
  //       frm.trigger("cancel_ticket_function");
  //     } else {
  //       frappe.show_alert({
  //         message: "Only Ticket Owner can Close this Ticket !!",
  //         indicator: "red",
  //       });
  //     }
  //   }
  // },

  // cancel_ticket_function: function (frm) {
  //   if (frm.doc.status == "Open") {
  //     frappe.prompt(
  //       {
  //         label: "Ticket Cancellation Reason",
  //         fieldname: "ticket_cancellation_reason",
  //         fieldtype: "Data",
  //         reqd: 1,
  //       },
  //       (values) => {
  //         console.log(values.ticket_cancellation_reason);
  //         frm.set_value("cancel_ticket", "Cancel Ticket");
  //         frm.set_value(
  //           "ticket_cancellation_reason",
  //           values.ticket_cancellation_reason
  //         );
  //         frm.set_value("status", "Cancelled");
  //         frm.refresh_field("status");
  //         frm.save();
  //       }
  //     );
  //   } else {
  //     frappe.show_alert({
  //       message: "Ticket Already Cancelled",
  //       indicator: "red",
  //     });
  //   }
  // },

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
              }
            );
          } else {
            frappe.msgprint(__("No eligible users found for this department."));
          }
        },
      });
    });
  },

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
                d.fields_dict.executive_remark.get_value()
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
      __("Status")
    );
  },

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
                d.fields_dict.resolved_remark.get_value()
              );
              frm.set_value("status", "Resolved");
              frm.refresh_field("status");
              frm.set_value("ticket_resolved_by", user);
              frm.set_value(
                "ticket_resolved_on",
                frappe.datetime.now_datetime()
              );
              frm.set_value("assigned_to", user);
              frm.save();
              d.hide();
            },
          });
          d.show();
        });
      },
      __("Status")
    );
  },

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

  close_button: function (frm) {
    frm
      .add_custom_button(__("Close"), function () {
        frappe.confirm(
          __(
            "Do you want to Close the Ticket? Once it is closed, it cannot be re-opened."
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
          }
        );
      })
      .css({
        "background-color": "#DC143C",
        color: "white",
        "border-color": "#B22222",
      });
  },

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
      __("Actions")
    );
  },
  reset_user_password: function (frm) {
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
                   <b>USER ID:</b> ${r.message.email}`
                  );

                  // Change button to Reset Password
                  d.set_primary_action(__("Reset Password"), function (values) {
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
                        if (res.message && res.message.message === "success") {
                          frappe.show_alert(
                            __(
                              "Password reset successfully for " +
                                r.message.full_name
                            )
                          );
                          d.hide();
                        } else {
                          frappe.msgprint(
                            __("Failed to reset password. Please try again.")
                          );
                        }
                      },
                    });
                  });
                } else {
                  // If user not found
                  d.set_value(
                    "user_info_html",
                    `<span style="color:red;">User not found.</span>`
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
      __("Actions")
    );
  },

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
});
