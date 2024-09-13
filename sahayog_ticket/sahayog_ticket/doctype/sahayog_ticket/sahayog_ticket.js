// Copyright (c) 2023, Sid and contributors

frappe.ui.form.on("Sahayog Ticket", {
  refresh: function (frm) {
    $("span.sidebar-toggle-btn").hide();
    $(".col-lg-2.layout-side-section").hide();
    frm.trigger("common_hidden_fields");
    frm.trigger("hide_timeline");

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
      frm.add_custom_button(__("Create Asset Request"), function () {
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
    } else {
      // If neither "ABPS" nor "MCPS" is found, use the numeric part as is
      modifiedEmployeeId = eid;
    }

    // Set the "employee_id" field with the modified value
    frm.set_value("employee_id", modifiedEmployeeId);
    let empid = frm.doc.employee_id;

    frm.call({
      method: "get_emp_details",
      args: {
        emp_id: empid,
      },
      callback: function (r) {
        // Check if the message array contains at least one object
        console.log(r.message);
        if (r.message.length > 0) {
          var firstName = r.message[0].first_name;
          var lastName = r.message[0].last_name;
          var fullName = firstName + " " + lastName;

          frm.set_value("emp_department", r.message[0].department);
          frm.set_value("division", r.message[0].division);
          frm.set_value("region", r.message[0].region);
          frm.set_value("branch_name", r.message[0].branch);
          frm.set_value("district", r.message[0].district);
          frm.set_value("phone1", r.message[0].cell_number);
          frm.set_value("designation", r.message[0].designation);
          frm.set_value("emp_first_name", firstName);
          frm.set_value("emp_last_name", lastName);
          frm.set_value("employee_name", fullName);
          frm.set_value("employee_user_id", r.message[0].user_id);
        }
      },
    });
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
        console.log(eid);
        var dept = frm.doc.dept_name;
        msgprint("Ticket is Saved Successfully.");
        msgprint(dept + " Team will Contact You Shortly");

        frappe.set_route("List", "Sahayog Ticket", {
          status: "Open",
          employee_user_id: frappe.session.user,
        });
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
    // if (
    //   frm.doc.status !== "Resolved" ||
    //   frm.doc.status !== "Closed" ||
    //   frm.doc.status !== "Cancelled"||
    // ) {
    //   frm.disable_save();
    // }

    //var ticketClosingDetailsSection = document.querySelectorAll(
    //"[data-fieldname='ticket_closing_details_section']"
    //    )[1];

    // Setting the background color to "#90EE90"
    //  if (ticketClosingDetailsSection) {
    //  ticketClosingDetailsSection.style.backgroundColor = "#90EE90";
    //}
    if (!frm.is_new()) {
      let emp_id = frm.doc.employee_id;
      let emp_name = frm.doc.employee_name;
      let emp_branch = frm.doc.branch_name;
      let emp_division = frm.doc.division;
      let emp_phone = frm.doc.phone1;
      let emp_designation = frm.doc.designation;
      let first_name = frm.doc.emp_first_name;
      let last_name = frm.doc.emp_last_name;
      let full_name = first_name + " " + last_name;
      //frm.set_value("employee_name", full_name);
      let ticket_department = frm.doc.dept_name;
      let ticket_type = frm.doc.ticket_type;
      let ticket_description = frm.doc.description;
      let ticket_tat = frm.doc.tat;
      let ticket_status = frm.doc.status;
      var intro_owner =
        "<div style='display: flex; align-items: stretch;'>" +
        "<div style='flex-basis: 35%; padding: 5px; border-radius: 10px 0 0 10px; margin-right: -5px; overflow: hidden;'>" +
        "<div style='background-color: #2a265f; padding: 15px; height: 100%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); border-top-left-radius: 10px; border-bottom-left-radius: 10px; line-height: 1;'>" +
        "<div style='display: flex; flex-wrap: wrap; justify-content: flex-end;'>" +
        "<div style='width: 60%;'>" +
        "<p style='font-size: 12px; margin-bottom: 3px;'>ID</p>" +
        "<p style='font-size: 13px; margin-bottom: 10px;'><b>" +
        emp_id +
        "</b></p>" +
        "<p style='font-size: 12px; margin-bottom: 3px;'>Employee</p>" +
        "<p style='font-size: 13px; margin-bottom: 10px;'><b>" +
        full_name +
        "</b></p>" +
        "<p style='font-size: 12px; margin-bottom: 3px;'>Designation</p>" +
        "<p style='font-size: 13px; margin-bottom: 10px;'><b>" +
        emp_designation +
        "</b></p>" +
        "</div>" +
        "<div class='second' style='width: 40%;text-align: left;'>" +
        "<p style='font-size: 12px; margin-bottom: 3px;'>Branch</p>" +
        "<p style='font-size: 13px; '><b>" +
        emp_branch +
        "</b></p>" +
        "<p style='font-size: 12px; margin-bottom: 3px;'>Division</p>" +
        "<p style='font-size: 13px; margin-bottom: 10px;'><b>" +
        emp_division +
        "</b></p>" +
        "<p style='font-size: 12px; margin-bottom: 3px;'>Phone</p>" +
        "<p style='font-size: 13px; '><b>" +
        emp_phone +
        "</b></p>" +
        "</div>" +
        "</div>" +
        "</div>" +
        "</div>" +
        "<div style='flex-basis: 65%; padding: 5px; border-radius: 0 10px 10px 0; margin-left: -5px; overflow: hidden;'>" +
        "<div style='background-color: #9693ff; padding: 15px; height: 100%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); border-top-right-radius: 10px; border-bottom-right-radius: 10px; line-height: 1;'>" +
        "<table style='width: 100%; table-layout: fixed; color: black;'>" +
        "<colgroup>" +
        "<col style='width: 25%;'>" +
        "<col style='width: 25%;'>" +
        "<col style='width: 25%;'>" +
        "<col style='width: 25%;'>" +
        "</colgroup>" +
        "<tr>" +
        "<td style='font-size: 12px; text-align: left;'>Raised To</td>" +
        "<td style='font-size: 12px; text-align: left;'>Type</td>" +
        "<td style='font-size: 12px; text-align: left;'>Status</td>" +
        "<td style='font-size: 12px; text-align: left;'>TAT</td>" +
        "</tr>" +
        "<tr>" +
        "<td style='font-size: 13px; font-weight: bold; text-align: left;'>" +
        ticket_department +
        "</td>" +
        "<td style='font-size: 13px; font-weight: bold; text-align: left;'>" +
        ticket_type +
        "</td>" +
        "<td style='font-size: 13px; font-weight: bold; text-align: left;'>" +
        ticket_status +
        "</td>" +
        "<td style='font-size: 13px; font-weight: bold; text-align: left;'>" +
        ticket_tat +
        "</td>" +
        "</tr>" +
        "</table>" +
        "<br><p style='font-size: 12px; margin-top: 10px; color:black'>Description</p>" +
        "<p style='font-size: 13px; color:black'><b>" +
        ticket_description +
        "</b></p>" +
        "</div>" +
        "</div>" +
        "</div>";

      frm.set_intro(intro_owner);

      var formMessage = document.querySelector(".form-message.blue");
      formMessage.style.background = "transparent";
      formMessage.style.padding = "0";
      formMessage.style.color = "white";

      var btnDefault = document.querySelectorAll(".btn.btn-default");
      var driverPopoverButton = document.querySelectorAll(
        "div#driver-popover-item .driver-popover-footer button.btn-default"
      );

      // btnDefault.forEach(function (element) {
      //   element.addEventListener("mouseover", function () {
      //     element.classList.remove("btn-default");
      //     element.classList.add("btn", "btn-danger");
      //   });

      //   element.addEventListener("mouseout", function () {
      //     element.classList.remove("btn-danger");
      //     element.classList.add("btn-default");
      //   });
      // });

      // driverPopoverButton.forEach(function (element) {
      //   element.addEventListener("mouseover", function () {
      //     element.classList.remove("btn-default");
      //     element.classList.add("btn", "btn-danger");
      //   });

      //   element.addEventListener("mouseout", function () {
      //     element.classList.remove("btn-danger");
      //     element.classList.add("btn-default");
      //   });
      // });
    }
    //----------------------------------------------------------------------------------------------
    //-----------------------------------------------------------------------------------------------
    let user = frappe.session.user;

    console.log("Logged-in-user = " + user);

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
      } else {
        // If neither "ABPS" nor "MCPS" is found, use the numeric part as is
        modifiedEmployeeId = eid;
      }

      // Set the "employee_id" field with the modified value
      frm.set_value("employee_id", modifiedEmployeeId);
      console.log("ID SET");

      // Check if the extracted employee ID matches the "employee_id" field
      if (modifiedEmployeeId === frm.doc.employee_id) {
        console.log("matched employee " + modifiedEmployeeId);

        // Toggle the display of the "status" field (hide it)
        //  frm.toggle_display("employee_id", false);
        //frm.toggle_display("status", false);
      }
    }

    if (!frm.is_new()) {
      if (frappe.user.has_role("System Manager")) {
        console.log("Admin");
        // In-Progress Button
        frm.add_custom_button(
          __("In-Progress"),
          function () {
            frappe.confirm(
              __("Are you sure you want to set In-Progress?"),
              function () {
                frm.set_value("status", "In-Progress");
                frm.refresh_field("status");
                frm.save();
              },
              function () {
                // Additional logic if No is selected in the confirmation
              }
            );
          },
          __("Admin")
        );
        frm.add_custom_button(
          __("Close"),
          function () {
            frappe.confirm(
              __("Are you sure you want to set In-Progress?"),
              function () {
                frm.set_value("status", "Closed");
                frm.refresh_field("status");
                frm.save();
              },
              function () {
                // Additional logic if No is selected in the confirmation
              }
            );
          },
          __("Admin")
        );
      } else if (frappe.user.has_role("Employee")) {
        console.log("Employee");
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
            //On-Hold Button
            frm.add_custom_button(
              __("On-Hold"),
              function () {
                let currentOnHoldRemark = frm.doc.on_hold_remark || ""; // Get the current value or initialize as an empty string

                frappe.confirm(
                  __("Do you want to set On-Hold "),
                  function () {
                    let d = new frappe.ui.Dialog({
                      title: "Enter On-Hold Remarks",
                      fields: [
                        {
                          label: "On-Hold Remark",
                          fieldname: "on_hold_remark",
                          fieldtype: "Small Text",
                          reqd: 1, // Set reqd property to make it mandatory
                          default: currentOnHoldRemark, // Set default value as current remark
                        },
                      ],
                      size: "small", // small, large, extra-large
                      primary_action_label: "Submit",
                      primary_action: function () {
                        // Your existing logic for handling the dialog submission
                        if (!d.fields_dict.on_hold_remark.get_value()) {
                          frappe.msgprint(__("Please provide On-Hold remark."));
                          return;
                        }

                        frm.set_value(
                          "on_hold_remark",
                          d.fields_dict.on_hold_remark.get_value()
                        );

                        frm.set_value("status", "On-Hold");
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
          }
          if (frm.doc.status == "Open") {
            //Read Button
            frm.add_custom_button(
              __("Read"),
              function () {
                frappe.confirm(
                  "Are you sure you want to Set Read ",
                  () => {
                    // action to perform if Yes is selected
                    frm.set_value("status", "Read");
                    frm.refresh_field("status");

                    frm.save();
                  },
                  () => {
                    // action to perform if No is selected
                  }
                );
              },
              __("Status")
            );
          }
          if (
            frm.doc.status == "Open" ||
            frm.doc.status == "Read" ||
            frm.doc.status == "On-Hold"
          ) {
            //In-Progress Button
            frm.add_custom_button(
              __("In-Progress"),
              function () {
                frappe.confirm(
                  "Are you sure you want to Set In-Progress ",
                  () => {
                    // action to perform if Yes is selected
                    frm.set_value("status", "In-Progress");
                    frm.refresh_field("status");

                    frm.save();
                  },
                  () => {
                    // action to perform if No is selected
                  }
                );
              },
              __("Status")
            );
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
            frm.add_custom_button(
              __("Resolved"),
              function () {
                let user = frappe.session.user;
                frappe.confirm(
                  __("Do you want to Resolve Ticket "),
                  function () {
                    let d = new frappe.ui.Dialog({
                      title: "Enter Resolve Remarks",
                      fields: [
                        {
                          label: "Resolved Remark",
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
                          "resolved_remark",
                          d.fields_dict.resolved_remark.get_value()
                        );

                        frm.set_value("ticket_resolved_by", user);
                        frm.set_value("status", "Resolved");
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
          }
        }
      }
      let user = frappe.session.user;
      // Get the numeric part of the user string
      let eid = user.match(/\d+/)[0];
      // Initialize the modified employee_id
      let modifiedEmployeeId = "";

      // Check if the user string contains "ABPS" or "MCPS"
      if (user.includes("ABPS")) {
        modifiedEmployeeId = "ABPS" + eid;
      } else if (user.includes("MCPS")) {
        modifiedEmployeeId = "MCPS" + eid;
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

        console.log("matched employee" + eid);
        frm.toggle_display("employee_id", false);
        frm.toggle_display("status", false);
        //frm.toggle_enable("priority", 0);

        if (frm.doc.status == "Cancel") {
        } else if (frm.doc.status == "Resolved") {
          frm
            .add_custom_button(__("Close"), function () {
              frappe.confirm(
                __("Do you want to close your Ticket ? "),
                function () {
                  let d = new frappe.ui.Dialog({
                    title: "Enter Closing Remark",
                    fields: [
                      {
                        label: "Ticket Closing Remark",
                        fieldname: "remark",
                        fieldtype: "Small Text",
                        reqd: 1, // Set reqd property to make it mandatory
                      },
                    ],
                    size: "small", // small, large, extra-large
                    primary_action_label: "Submit",
                    primary_action: function () {
                      // Your existing logic for handling the dialog submission
                      if (!d.fields_dict.remark.get_value()) {
                        frappe.msgprint(__("Please provide Closing remark."));
                        return;
                      }

                      frm.set_value("remark", d.fields_dict.remark.get_value());

                      frm.set_value("status", "Closed");
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
            })
            .css({
              "background-color": "#00CA4E", // Set green color
              color: "#ffffff", // Set font color to white
            });

          frm
            .add_custom_button(__("Re-Open"), function () {
              frappe.confirm(
                __("Do you want to re-open your Ticket?"),
                function () {
                  let d = new frappe.ui.Dialog({
                    title: "Enter Re-Open Remark",
                    fields: [
                      {
                        label: "Re-Open Remark",
                        fieldname: "reopen_remark",
                        fieldtype: "Small Text",
                        reqd: 1, // Set reqd property to make it mandatory
                      },
                    ],
                    size: "small", // small, large, extra-large
                    primary_action_label: "Submit",
                    primary_action: function () {
                      // Your existing logic for handling the dialog submission
                      if (!d.fields_dict.reopen_remark.get_value()) {
                        frappe.msgprint(__("Please provide Re-Open remark."));
                        return;
                      }

                      frm.set_value(
                        "reopen_remark",
                        d.fields_dict.reopen_remark.get_value()
                      );

                      frm.set_value("status", "Re-Opened");
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
            })
            .css({
              "background-color": "#FF605C", // Set green color
              color: "#ffffff", // Set font color to white
            });
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
          //On-Hold Button
          frm.add_custom_button(
            __("On-Hold"),
            function () {
              let currentOnHoldRemark = frm.doc.on_hold_remark || ""; // Get the current value or initialize as an empty string

              frappe.confirm(
                __("Do you want to set On-Hold "),
                function () {
                  let d = new frappe.ui.Dialog({
                    title: "Enter On-Hold Remarks",
                    fields: [
                      {
                        label: "On-Hold Remark",
                        fieldname: "on_hold_remark",
                        fieldtype: "Small Text",
                        reqd: 1, // Set reqd property to make it mandatory
                        default: currentOnHoldRemark, // Set default value as current remark
                      },
                    ],
                    size: "small", // small, large, extra-large
                    primary_action_label: "Submit",
                    primary_action: function () {
                      // Your existing logic for handling the dialog submission
                      if (!d.fields_dict.on_hold_remark.get_value()) {
                        frappe.msgprint(__("Please provide On-Hold remark."));
                        return;
                      }

                      frm.set_value(
                        "on_hold_remark",
                        d.fields_dict.on_hold_remark.get_value()
                      );

                      frm.set_value("status", "On-Hold");
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
        }
        if (frm.doc.status == "Open") {
          //Read Button
          frm.add_custom_button(
            __("Read"),
            function () {
              frappe.confirm(
                "Are you sure you want to Set Read ",
                () => {
                  // action to perform if Yes is selected
                  frm.set_value("status", "Read");
                  frm.refresh_field("status");

                  frm.save();
                },
                () => {
                  // action to perform if No is selected
                }
              );
            },
            __("Status")
          );
        }
        if (
          frm.doc.status == "Open" ||
          frm.doc.status == "Read" ||
          frm.doc.status == "On-Hold"
        ) {
          //In-Progress Button
          frm.add_custom_button(
            __("In-Progress"),
            function () {
              frappe.confirm(
                "Are you sure you want to Set In-Progress ",
                () => {
                  // action to perform if Yes is selected
                  frm.set_value("status", "In-Progress");
                  frm.refresh_field("status");

                  frm.save();
                },
                () => {
                  // action to perform if No is selected
                }
              );
            },
            __("Status")
          );
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
          frm.add_custom_button(
            __("Resolved"),
            function () {
              let user = frappe.session.user;
              frappe.confirm(
                __("Do you want to Resolve Ticket "),
                function () {
                  let d = new frappe.ui.Dialog({
                    title: "Enter Resolve Remarks",
                    fields: [
                      {
                        label: "Resolved Remark",
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
                        "resolved_remark",
                        d.fields_dict.resolved_remark.get_value()
                      );

                      frm.set_value("ticket_resolved_by", user);
                      frm.set_value("status", "Resolved");
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
