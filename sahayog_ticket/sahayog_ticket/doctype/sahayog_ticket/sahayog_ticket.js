// Copyright (c) 2023, Sid and contributors

// Copyright (c) 2023, Sid and contributors

frappe.ui.form.on("Sahayog Ticket", {
  refresh: function (frm) {
    frm.trigger("common_hidden_fields");
    frm.trigger("hide_timeline");

    if (frm.is_new()) {
      frm.trigger("Set_Employee_Details");
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
    let user = frappe.session.user;
    if (frm.is_new()) {
      frm.set_df_property("cancel_ticket_btn", "hidden", 1);
      let eid = user.match(/\d+/)[0];
      let modifiedEmployeeId = "";

      if (user.includes("ABPS")) {
        modifiedEmployeeId = "ABPS" + eid;
      } else if (user.includes("MCPS")) {
        modifiedEmployeeId = "MCPS" + eid;
      } else if (user.includes("NT")) {
        modifiedEmployeeId = "NT" + eid;
      } else {
        modifiedEmployeeId = eid;
      }

      frm.set_value("employee_id", modifiedEmployeeId);
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

      let eid = user.match(/\d+/)[0];
      console.log("Eid-", eid);
      let modifiedEmployeeId = "";

      if (user.includes("ABPS")) {
        modifiedEmployeeId = "ABPS" + eid;
      } else if (user.includes("MCPS")) {
        modifiedEmployeeId = "MCPS" + eid;
      } else if (user.includes("NT")) {
        modifiedEmployeeId = "NT" + eid;
      } else {
        modifiedEmployeeId = eid;
      }

      if (modifiedEmployeeId === frm.doc.employee_id) {
        if (frm.doc.status == "Open") {
          frm.set_df_property("cancel_ticket_btn", "hidden", 0);
          document.querySelectorAll(
            "[data-fieldname='cancel_ticket_btn']"
          )[1].style.backgroundColor = "red";
          document.querySelectorAll(
            "[data-fieldname='cancel_ticket_btn']"
          )[1].style.color = "white";
          document.querySelectorAll(
            "[data-fieldname='cancel_ticket_btn']"
          )[1].style.fontWeight = "bold";
        }
        {
          frm.disable_save();
        }

        frm.toggle_display("employee_id", false);
        frm.toggle_display("status", false);
      } else {
        frm.set_df_property("cancel_ticket_btn", "hidden", 1);
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
  },

  set_intro: function (frm) {
    // Refresh-specific logic moved here from second handler
    if (!frm.is_new()) {
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
              "https://cdn-icons-png.flaticon.com/128/1710/1710475.png";

            const ticket_department = frm.doc.dept_name || "Not specified";
            const ticket_type = frm.doc.ticket_type || "Not specified";
            const ticket_tat = frm.doc.tat || "N/A";
            const ticket_assigned_to = frm.doc.assigned_to_name;

            const intro_owner = `
              <div class="employee-ticket-card">
                <div class="employee-photo">
                  <img class="profile-image" src="${emp_profile_picture}" alt="Profile Image" />
                </div>
                <div class="employee-details">
                  <div class="employee-name-id"><strong>${full_name}</strong> - ${emp_id}</div>
                  <div class="employee-meta">
                    ${emp_designation}, ${emp_department}, ${emp_branch}, ${emp_division}<br>
                    Phone : ${emp_phone}
                  </div>
                </div>
              </div>
              <div class="terminal-style">
                <div class="terminal-line">
                  <span class="terminal-prompt">${full_name}:~$</span>
                  <span class="terminal-command">${ticket_department} → ${ticket_type} → ${ticket_tat}</span>
                </div>
                <div class="terminal-end">
                  <span class="terminal-prompt">Assign to:</span>
                  <span class="terminal-command">${ticket_assigned_to}</span>

                </div>
              </div>

              <style>
                .terminal-style {
                  background-color: #282c34;
                  color: #abb2bf;
                  padding: 12px;
                  border-radius: 6px;
                  font-family: 'Courier New', monospace;
                  margin: 5px 0px;
                  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                  display: flex;
                  justify-content: space-between;
                }
                .terminal-prompt {
                  color: #98c379;
                  margin-right: 8px;
                }
                .terminal-command {
                  color: #e06c75;
                }
                .terminal-command::before {
                  content: " ";
                }
                .employee-ticket-card {
                  display: flex;
                  align-items: center;
                  padding: 15px;
                  background: linear-gradient(90deg, #673AB7, #512DA8, #303F9F);
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  border-radius: 9px;
                  font-family: 'Courier New', monospace;
                }
                .employee-photo {
                  margin-right: 15px;
                }
                .profile-image {
                  width: 60px;
                  height: 60px;
                  border-radius: 50%;
                  object-fit: cover;
                }
                .employee-details {
                  display: flex;
                  flex-direction: column;
                }
                .employee-name-id {
                  font-size: 16px;
                  margin-bottom: -3px;
                }
                .employee-meta {
                  font-size: 13px;
                  color: #c3c3c3;
                }
                @media (max-width: 768px) {
                  .employee-ticket-card {
                    flex-direction: column;
                    text-align: center;
                  }
                  .terminal-style {
                    margin: 10px 5px;
                    font-size: 13px;
                  }
                }
              </style>
            `;

            frm.set_intro(intro_owner);
            var formMessage = document.querySelector(".form-message.blue");
            formMessage.style.background = "transparent";
            formMessage.style.padding = "0";
            formMessage.style.color = "white";
          } else {
            frm.set_intro("Employee information not available", "red");
            console.error("[ERROR] No employee data found");
          }
        },
      });
    }
  },

  before_save: function (frm) {
    // Empty as per original
  },

  after_save: function (frm) {
    let user = frappe.session.user;
    let match = user.match(/\d+/);
    let eid = match ? match[0] : null;

    if (eid === frm.doc.employee_id) {
      if (frm.doc.status == "Open") {
        var dept = frm.doc.dept_name;
        msgprint("Ticket is Saved Successfully.");
        msgprint(dept + " Team will Contact You Shortly");
        frappe.set_route("List", "Sahayog Ticket", { status: "Open" });
      }
    }

    if (frm.doc.status == "Closed") {
      frm.set_df_property("status", "read_only", 1);
      frm.set_df_property("assigned_it", "read_only", 1);
      frm.set_df_property("close_remark", "read_only", 1);
      msgprint("Ticket is Closed Successfully . .");
      frm.disable_save();
    }

    if (frm.doc.cancel_ticket == "Cancel Ticket") {
      frm.set_df_property("status", "read_only", 1);
      frm.set_df_property("assigned_it", "read_only", 1);
      msgprint("Ticket is Cancelled Successfully . .");
      frm.disable_save();
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

  Set_Employee_Details: function (frm) {
    let user;
    if (frm.is_new()) {
      user = frappe.session.user;
    } else if (!frm.is_new()) {
      console.log("Eid-", frm.doc.employee_id);
      user = frm.doc.employee_id;
    }

    let eid = user.match(/\d+/)[0];
    let modifiedEmployeeId = "";

    if (user.includes("ABPS")) {
      modifiedEmployeeId = "ABPS" + eid;
    } else if (user.includes("MCPS")) {
      modifiedEmployeeId = "MCPS" + eid;
    } else if (user.includes("NT")) {
      modifiedEmployeeId = "NT" + eid;
    } else {
      modifiedEmployeeId = eid;
    }

    frm.set_value("employee_id", modifiedEmployeeId);
  },

  cancel_ticket_btn: function (frm) {
    if (!frm.is_new()) {
      let user = frappe.session.user;
      let eid = user.match(/\d+/)[0];

      if (eid === frm.doc.employee_id) {
        frm.trigger("cancel_ticket_function");
      } else {
        frappe.show_alert({
          message: "Only Ticket Owner can Close this Ticket !!",
          indicator: "red",
        });
      }
    }
  },

  cancel_ticket_function: function (frm) {
    if (frm.doc.status == "Open") {
      frappe.prompt(
        {
          label: "Ticket Cancellation Reason",
          fieldname: "ticket_cancellation_reason",
          fieldtype: "Data",
          reqd: 1,
        },
        (values) => {
          console.log(values.ticket_cancellation_reason);
          frm.set_value("cancel_ticket", "Cancel Ticket");
          frm.set_value(
            "ticket_cancellation_reason",
            values.ticket_cancellation_reason
          );
          frm.set_value("status", "Cancelled");
          frm.refresh_field("status");
          frm.save();
        }
      );
    } else {
      frappe.show_alert({
        message: "Ticket Already Cancelled",
        indicator: "red",
      });
    }
  },

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
});
