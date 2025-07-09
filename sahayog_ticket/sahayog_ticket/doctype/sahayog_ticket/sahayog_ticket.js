// Copyright (c) 2023, Sid and contributors

frappe.ui.form.on("Sahayog Ticket", {
  refresh: function (frm) {
    //$("span.sidebar-toggle-btn").hide();
    //$(".col-lg-2.layout-side-section").hide();
    frm.trigger("common_hidden_fields");
    //frm.trigger("hide_timeline");

    if (frm.is_new()) {
      //Employee Trigger when form is new
      frm.trigger("Set_Employee_Details");
      frm.trigger("Employee_hidden_fields");
    } else if (!frm.is_new()) {
      frm.trigger("create_asset_request");
      frm.trigger("status_color");
      frm.trigger("it_support_manager_fields_show");
    }
  },

  create_asset_request: function (frm) {
    // Check if asset_request_id exists
    if (frm.doc.asset_request_id) {
      // Show button to view Asset Request if asset_request_id exists
      frm.add_custom_button(__("View Asset Request"), function () {
        frappe.set_route("Form", "Asset Request", frm.doc.asset_request_id);
      });
    } else if (
      // Show "Create Asset Request" button if user has any of the specified roles
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

        if (request_department) {
          console.log("Request Department set to " + request_department);
        } else {
          console.log("No matching role found");
        }
        let user = frappe.session.user;
        frappe.confirm(
          __("Are you sure you want to create Asset Request?"),
          function () {
            frm.call({
              method: "create_asset_request", // Use the correct dotted path for your method
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
                  frm.set_value(
                    "remark",
                    `Created Asset Request - ${response.message.asset_request_id}`
                  );
                  frm.refresh_field("status");

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
          },
          function () {
            // Additional logic if No is selected in the confirmation
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
    // Check if the user has the "System Manager" role
    const hasSystemManagerRole = frappe.user_roles.includes("System Manager");

    // Get all timeline items
    let timeline_items = frm.timeline.wrapper.find(".timeline-item");

    // Iterate through timeline items and hide entries based on specific criteria
    timeline_items.each(function () {
      let item = $(this);
      let itemText = item.text();

      // Hide entries containing 'OTP', 'New Email', or 'Notification sent to' if the user is not a System Manager
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

    if (frappe.user.has_role("Administrator")) {
    }

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

    // Get the numeric part of the user string
    let eid = user.match(/\d+/)[0];

    // Initialize the modified employee_id
    let modifiedEmployeeId = "";

    // Check if the user string contains "ABPS" or "MCPS"
    if (user.includes("ABPS")) {
      modifiedEmployeeId = "ABPS" + eid;
    } else if (user.includes("MCPS")) {
      modifiedEmployeeId = "MCPS" + eid;
    } else if (user.includes("NT")) {
      modifiedEmployeeId = "NT" + eid;
    } else {
      // If neither "ABPS" nor "MCPS" is found, use the numeric part as is
      modifiedEmployeeId = eid;
    }

    // Set the "employee_id" field with the modified value
    frm.set_value("employee_id", modifiedEmployeeId);
    let empid = frm.doc.employee_id;
  },

  cancel_ticket_btn: function (frm) {
    if (!frm.is_new()) {
      let user = frappe.session.user;
      let eid = user.match(/\d+/)[0];

      if (eid === frm.doc.employee_id) {
        //frappe.msgprint("Employee Matched");
        frm.trigger("cancel_ticket_function");
      } else {
        frappe.show_alert({
          message: "Only Ticket Owner can Close this Ticket !!",
          indicator: "red",
        });
      }
    }
  },

  dept_name: function (frm) {
    console.log("Dept : " + frm.doc.dept_name);
  },

  priority: function (frm) {
    console.log("priority : " + frm.doc.priority);
    frm.trigger("priority_for_it");
  },

  priority_for_it: function (frm) {
    if (frm.doc.priority == "Normal") {
      frm.set_value("tat", "3 Days");
    } else if (frm.doc.priority == "Medium") {
      frm.set_value("tat", "2 Days");
    } else if (frm.doc.priority == "High") {
      frm.set_value("tat", "1 Day");
    } else if (frm.doc.priority == "Urgent") {
      frm.set_value("tat", "4 Hours");
    }
  },

  cancel_ticket_function(frm) {
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

  before_save: function (frm) {
    if (!frm.is_new()) {
      // let creation_date_time = frm.doc.creation;
      // // Convert the creation_date_time string to a Date object
      // let creationDate = new Date(creation_date_time);
      // // Extract the creation time from the Date object in 12-hour AM/PM format
      // let creationTime = creationDate.toLocaleTimeString([], {
      //   hour: "2-digit",
      //   minute: "2-digit",
      //   hour12: true,
      // });
      // // Print the creation time to the console (for testing)
      // console.log("Time: " + creationTime);
      // frm.set_value("creation_time", creationTime);
      // // You can then use the creationTime variable as needed in your code
    }
  },

  dept_name: function (frm) {
    // Clear previous filters
    frm.refresh_field("ticket_type");

    // Apply new filter based on the selected department
    const department = frm.doc.dept_name;

    // Apply query filter based on the selected department
    frm.set_query("ticket_type", function () {
      return {
        filters: {
          department: department,
          enable: "1",
        },
      };
    });
  },
  onload_post_render: function (frm) {
    // frm.fields_dict.dept_name.$input.on("input", function (evt) {
    //   // Get the selected department value
    //   var selected_dept = evt.target.value;
    //   // Log the selected department to the console
    //   console.log(selected_dept);
    //   frm.set_value("ticket_type", "");
    // });
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
      } else {
        //console.log("not owner");
      }
    } else {
      //console.log("not owner");
    }

    if (frm.doc.status == "Closed") {
      frm.set_df_property("status", "read_only", 1);

      frm.set_df_property("assigned_it", "read_only", 1);

      frm.set_df_property("remark", "read_only", 1);

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
});

frappe.ui.form.on("Sahayog Ticket", {
  refresh: function (frm) {
    if (!frm.is_new()) {
      // Fetch employee data

      frm.call({
        method: "get_employee_info",
        args: {
          employee_number: frm.doc.employee_id,
        },
        callback: function (r) {
          if (r.message) {
            let data = r.message; // avoid overwriting 'r'
            // Employee data
            const emp_id = frm.doc.employee_id;
            const full_name = data.employee_name;
            const emp_designation = data.designation || "Not specified";
            const emp_branch = data.branch || "Not specified";
            const emp_department = data.department || "Not specified";
            const emp_phone = data.cell_number || "Not available";
            const emp_division = data.custom_division || "Not available";
            const emp_profile_picture =
              "https://cdn-icons-png.flaticon.com/128/1710/1710475.png"; // Default if no picture

            // Ticket data
            const ticket_department = frm.doc.dept_name || "Not specified";
            const ticket_type = frm.doc.ticket_type || "Not specified";
            const ticket_tat = frm.doc.tat || "N/A";

            // Combined HTML layout
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
            </div>
          
            <style>
              /* Terminal Style */
              .terminal-style {
                background-color: #282c34;
                color: #abb2bf;
                padding: 12px;
                border-radius: 6px;
                font-family: 'Courier New', monospace;
                margin: 5px 0px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
              }
          
              .terminal-prompt {
                color: #98c379; /* Green color for prompt */
                margin-right: 8px;
              }
          
              .terminal-command {
                color: #e06c75; /* Red color for command */
              }
          
              .terminal-command::before {
                content: " ";
              }
          
              /* Employee Card (unchanged) */
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

            var btnDefault = document.querySelectorAll(".btn.btn-default");
            var driverPopoverButton = document.querySelectorAll(
              "div#driver-popover-item .driver-popover-footer button.btn-default"
            );
          } else {
            frm.set_intro("Employee information not available", "red");
            console.error("[ERROR] No employee data found");
          }
        },
      });
    }

    //----------------------------------------------------------------------------------------------
    //-----------------------------------------------------------------------------------------------
    let user = frappe.session.user;

    if (frm.is_new()) {
      frm.set_df_property("cancel_ticket_btn", "hidden", 1);
      // Get the numeric part of the user string
      let eid = user.match(/\d+/)[0];

      // Initialize the modified employee_id
      let modifiedEmployeeId = "";

      // Check if the user string contains "ABPS" or "MCPS"
      if (user.includes("ABPS")) {
        modifiedEmployeeId = "ABPS" + eid;
      } else if (user.includes("MCPS")) {
        modifiedEmployeeId = "MCPS" + eid;
      } else if (user.includes("NT")) {
        modifiedEmployeeId = "NT" + eid;
      } else {
        // If neither "ABPS" nor "MCPS" is found, use the numeric part as is
        modifiedEmployeeId = eid;
      }

      // Set the "employee_id" field with the modified value
      frm.set_value("employee_id", modifiedEmployeeId);

      // Check if the extracted employee ID matches the "employee_id" field
      if (modifiedEmployeeId === frm.doc.employee_id) {
        // Toggle the display of the "status" field (hide it)
        //  frm.toggle_display("employee_id", false);
        //frm.toggle_display("status", false);
      }
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

        // Show buttons based on ticket status
        if (frm.doc.status === "Open") {
          frm.trigger("In_Progress_button");
          frm.trigger("resolve_button");
        } else if (frm.doc.status === "In-Progress") {
          frm.trigger("resolve_button");
          frm.trigger("executive_remark");
        }
      }

      if (frappe.user.has_role("System Manager")) {
      } else if (frappe.user.has_role("Employee")) {
        console.log("Employee");
        // Employee buttons (outside executive role check)
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

          if (
            frm.doc.status == "Re-Opened" ||
            frm.doc.status == "Read" ||
            frm.doc.status == "In-Progress"
          ) {
          }
          if (frm.doc.status == "Open") {
          }
          if (frm.doc.status == "Open") {
          }
          if (frm.doc.status == "Resolved") {
            frm.disable_save();
          }

          if (
            frm.doc.status !== "Resolved" &&
            frm.doc.status !== "Closed" &&
            frm.doc.status !== "Cancelled"
          ) {
            console.log("resolve button");
            //Resolved Button show
          }
        }
      }
      let user = frappe.session.user;
      // Get the numeric part of the user string
      let eid = user.match(/\d+/)[0];
      console.log("Eid-", eid);
      // Initialize the modified employee_id
      let modifiedEmployeeId = "";

      // Check if the user string contains "ABPS" or "MCPS"
      if (user.includes("ABPS")) {
        modifiedEmployeeId = "ABPS" + eid;
      } else if (user.includes("MCPS")) {
        modifiedEmployeeId = "MCPS" + eid;
      } else if (user.includes("NT")) {
        modifiedEmployeeId = "NT" + eid;
      } else {
        // If neither "ABPS" nor "MCPS" is found, use the numeric part as is
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
        //frm.toggle_enable("priority", 0);

        if (frm.doc.status == "Cancel") {
        } else if (frm.doc.status == "Resolved") {
          frm;
        }
      }

      //For Executives
      else {
        frm.set_df_property("cancel_ticket_btn", "hidden", 1);
        if (
          frm.doc.status == "Read" ||
          frm.doc.status == "In-Progress" ||
          frm.doc.status == "On-Hold"
        ) {
          frm.disable_save();
        }

        if (
          frm.doc.status == "Re-Opened" ||
          frm.doc.status == "Read" ||
          frm.doc.status == "In-Progress"
        ) {
        }

        if (
          frm.doc.status == "Open" ||
          frm.doc.status == "Read" ||
          frm.doc.status == "On-Hold"
        ) {
        }
        if (frm.doc.status == "Resolved") {
          frm.disable_save();
        }

        if (
          frm.doc.status !== "Resolved" &&
          frm.doc.status !== "Closed" &&
          frm.doc.status !== "Cancelled"
        ) {
          console.log("resolve button");
          //Resolved Button show
        }
      }
    }
    if (frm.doc.dept_name == "" || null) {
      frm.doc.status = "New";
    }
    const onhold = 96;
    const onholdhit = 104;

    const normal = 72;
    const normalhit = 78;

    const medium = 48;
    const mediumhit = 54;

    const high = 24;
    const highhit = 28;

    const urgent = 4;
    const urgenthit = 6;

    if (frappe.user.has_role("Stationery Store & Support Manager")) {
      console.log("stationery");
      frm.remove_custom_button("Resolved", "Status");
      frm.remove_custom_button("Read", "Status");
      frm.remove_custom_button("On-Hold", "Status");
      frm.remove_custom_button("In-Progress", "Status");
    }
  },

  In_Progress_button: function (frm) {
    frm.add_custom_button(
      __("In-Progress"),
      function () {
        let currentOnHoldRemark = frm.doc.on_hold_remark || ""; // Get the current value or initialize as an empty string

        frappe.confirm(
          __("Do you want to set In-Progress "),
          function () {
            let d = new frappe.ui.Dialog({
              title: "Enter In-Progress Remarks",
              fields: [
                {
                  label: "In-Progress Remark",
                  fieldname: "executive_remark",
                  fieldtype: "Small Text",
                  reqd: 1, // Set reqd property to make it mandatory
                  default: currentOnHoldRemark, // Set default value as current remark
                },
              ],
              size: "small", // small, large, extra-large
              primary_action_label: "Submit",
              primary_action: function () {
                // Your existing logic for handling the dialog submission
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
                frm.save();

                d.hide();
              },
            });

            d.show();
          },
          function () {
            // Additional logic if No is selected in the confirmation
          }
        );
      },
      __("Status")
    );
  },
  resolve_button: function (frm) {
    frm.add_custom_button(
      __("Resolve"),
      function () {
        let user = frappe.session.user;
        frappe.confirm(
          __("Do you want to Resolve the Ticket "),
          function () {
            let d = new frappe.ui.Dialog({
              title: "Enter Resolve Remark",
              fields: [
                {
                  label: "Resolve Remark",
                  fieldname: "resolved_remark",
                  fieldtype: "Small Text",
                  reqd: 1, // Set reqd property to make it mandatory
                },
              ],
              size: "small", // small, large, extra-large
              primary_action_label: "Submit",
              primary_action: function () {
                // Your existing logic for handling the dialog submission
                if (!d.fields_dict.resolved_remark.get_value()) {
                  frappe.msgprint(__("Please provide Resolve remark."));
                  return;
                }

                frm.set_value(
                  "remark",
                  d.fields_dict.resolved_remark.get_value()
                );

                frm.set_value("ticket_resolved_by", user);
                frm.set_value("status", "Resolved");
                frm.set_value(
                  "ticket_resolved_on",
                  frappe.datetime.now_datetime()
                );
                frm.refresh_field("status");
                frm.save();

                d.hide();
              },
            });

            d.show();
          },
          function () {
            // Additional logic if No is selected in the confirmation
          }
        );
      },
      __("Status")
    );
  },

  reopen_button: function (frm) {
    frm
      .add_custom_button(__("Re-Open"), function () {
        console.log("Re-Open button clicked");
      })
      .css({
        "background-color": "#FFA500", // Orange color
        color: "white",
        "border-color": "#FF8C00",
      });
  },

  close_button: function (frm) {
    frm
      .add_custom_button(__("Close"), function () {
        console.log("Close button clicked");
      })
      .css({
        "background-color": "#FF0000", // Red color
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
      __("Actions") // Optional group label
    );
  },
});

frappe.ui.form.on("Sahayog Ticket", {
  onload: function (frm) {
    if ((frm.doc.dept_name == null || "") && (frm.doc.desc == null || "")) {
      console.log("its blank");
    } else if (
      (!frm.doc.dept_name == null || "") &&
      (!frm.doc.desc == null || "")
    ) {
      frm.save();
    }

    if (frm.doc.status == "Closed" || frm.doc.status == "Cancelled") {
      frm.disable_save();
    } else if (frm.doc.status !== "Closed" || frm.doc.status !== "Cancelled") {
      // frm.set_value("due_time", frappe.datetime.now_datetime());
      // frm.set_value(
      //   "total_hours",
      //   frappe.datetime.get_hour_diff(frm.doc.due_time, frm.doc.on_hold_time)
      // );
      // frm.set_value(
      //   "total_days",
      //   frappe.datetime.get_day_diff(frm.doc.due_time, frm.doc.on_hold_time)
      // );
    }
  },
});
