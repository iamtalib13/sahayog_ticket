// Copyright (c) 2023, Sid and contributors

// Hello from

frappe.ui.form.on("Sahayog Ticket", {
  refresh: function (frm) {
    if (frm.is_new()) {
    } else if (!frm.is_new()) {
    }
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

  refresh: function (frm) {
    if (!frm.is_new()) {
    }
  },

  dept_name: function (frm) {
    // Clear previous filters
    frm.refresh_field("ticket_type");
    frm.refresh_field("dept_name");

    // Apply new filter based on selected department
    if (frm.doc.dept_name == "HR") {
      frm.set_query("ticket_type", function () {
        return {
          filters: {
            department: "HR",
          },
        };
      });
    }

    if (frm.doc.dept_name == "Admin") {
      frm.set_query("ticket_type", function () {
        return {
          filters: {
            department: "Admin",
          },
        };
      });
    }
    if (frm.doc.dept_name == "Loan") {
      frm.set_query("ticket_type", function () {
        return {
          filters: {
            department: "Loan",
          },
        };
      });
    }

    if (frm.doc.dept_name == "Accounts") {
      frm.set_query("ticket_type", function () {
        return {
          filters: {
            department: "Accounts",
          },
        };
      });
    }

    if (frm.doc.dept_name == "IT") {
      frm.set_query("ticket_type", function () {
        return {
          filters: {
            department: "IT",
          },
        };
      });
    }

    if (frm.doc.dept_name == "Facility") {
      frm.set_query("ticket_type", function () {
        return {
          filters: {
            department: "Facility",
          },
        };
      });
    }

    if (frm.doc.dept_name == "MIS") {
      frm.set_query("ticket_type", function () {
        return {
          filters: {
            department: "MIS",
          },
        };
      });
    }

    if (frm.doc.dept_name == "JLL") {
      frm.set_query("ticket_type", function () {
        return {
          filters: {
            department: "JLL",
          },
        };
      });
    }

    if (frm.doc.dept_name == "Operations") {
      frm.set_query("ticket_type", function () {
        return {
          filters: {
            department: "Operations",
          },
        };
      });
    }

    if (frm.doc.dept_name == "HO") {
      frm.set_query("ticket_type", function () {
        return {
          filters: {
            department: "HO",
          },
        };
      });
    }
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
        frappe.set_route("List", "Sahayog Ticket");
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
    let label;
    let color;
    if (frm.doc.status == "Open") {
      label = "Open";
      color = "red";
    } else if (frm.doc.status == "Read") {
      label = "Read";
      color = "orange";
    } else if (frm.doc.status == "In-Progress") {
      label = "In-Progress";
      color = "yellow";
    } else if (frm.doc.status == "On-Hold") {
      label = "On-Hold";
      color = "purple";
    } else if (frm.doc.status == "Closed") {
      label = "Closed";
      color = "green";
    } else if (frm.doc.status == "Cancelled") {
      label = "Cancelled";
      color = "grey";
    } else {
      // If the status is not recognized, set a default label and color
      label = frm.doc.status;
      color = "grey";
    }
    frm.page.set_indicator(__(label), color);
  },

  refresh: function (frm) {
    var ticketClosingDetailsSection = document.querySelectorAll(
      "[data-fieldname='ticket_closing_details_section']"
    )[1];

    // Setting the background color to "#90EE90"
    if (ticketClosingDetailsSection) {
      ticketClosingDetailsSection.style.backgroundColor = "#90EE90";
    }
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
        frm.toggle_display("employee_id", false);
        frm.toggle_display("status", false);
      }
    }

    if (!frm.is_new()) {
      let user = frappe.session.user;
      let match = user.match(/\d+/);
      let eid = match ? match[0] : null;

      if (eid === frm.doc.employee_id) {
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
