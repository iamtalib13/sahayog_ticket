// Copyright (c) 2023, Sid and contributors

// Hello from

frappe.ui.form.on("Sahayog Ticket", {
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
      let creation_date_time = frm.doc.creation;

      // Convert the creation_date_time string to a Date object
      let creationDate = new Date(creation_date_time);

      // Extract the creation time from the Date object in 12-hour AM/PM format
      let creationTime = creationDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Print the creation time to the console (for testing)

      frm.set_value("creation_time", creationTime);

      // You can then use the creationTime variable as needed in your code
    }
  },

  refresh: function (frm) {
    if (!frm.is_new()) {
      let creation_date_time = frm.doc.creation;

      // Convert the creation_date_time string to a Date object
      let creationDate = new Date(creation_date_time);

      // Extract the creation time from the Date object in 12-hour AM/PM format
      let creationTime = creationDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Print the creation time to the console (for testing)
      console.log("Time: " + creationTime);
      frm.set_value("creation_time", creationTime);

      // You can then use the creationTime variable as needed in your code
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
    frm.fields_dict.dept_name.$input.on("input", function (evt) {
      // Get the selected department value
      var selected_dept = evt.target.value;

      // Log the selected department to the console
      console.log(selected_dept);
      frm.set_value("ticket_type", "");
    });
  },

  after_save: function (frm) {
    if (frm.doc.on_hold_time == frm.doc.due_time) {
      console.log("True");
      console.log(frm.doc.on_hold_time);
      console.log(frm.doc.due_time);
      var dept = frm.doc.dept_name;
      frm.set_value("status", "Open");
      msgprint("Ticket is Saved Successfully.");
      msgprint(dept + " Team will Contact You Shortly");
      frappe.set_route("List", "Sahayog Ticket");
    } else {
      console.log("False");
      console.log(frm.doc.on_hold_time);
      console.log(frm.doc.due_time);
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
      frm.set_value("employee_name", full_name);
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

      btnDefault.forEach(function (element) {
        element.addEventListener("mouseover", function () {
          element.classList.remove("btn-default");
          element.classList.add("btn", "btn-danger");
        });

        element.addEventListener("mouseout", function () {
          element.classList.remove("btn-danger");
          element.classList.add("btn-default");
        });
      });

      driverPopoverButton.forEach(function (element) {
        element.addEventListener("mouseover", function () {
          element.classList.remove("btn-default");
          element.classList.add("btn", "btn-danger");
        });

        element.addEventListener("mouseout", function () {
          element.classList.remove("btn-danger");
          element.classList.add("btn-default");
        });
      });
    }
    //----------------------------------------------------------------------------------------------
    //-----------------------------------------------------------------------------------------------
    let user = frappe.session.user;

    console.log("Logged-in-user = " + user);

    if (frm.is_new()) {
      let eid = user.match(/\d+/)[0];
      frm.set_value("employee_id", eid);
      console.log("ID SET");

      if (eid === frm.doc.employee_id) {
        console.log("matched employee" + eid);
        frm.toggle_display("employee_id", false);
        frm.toggle_display("status", false);
      }
    }
    if (!frm.is_new()) {
      let eid = user.match(/\d+/)[0];

      if (eid === frm.doc.employee_id) {
        console.log("matched employee" + eid);
        frm.toggle_display("employee_id", false);
        frm.toggle_display("status", false);
        frm.disable_save();
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
      frm.set_value("due_time", frappe.datetime.now_datetime());

      frm.set_value(
        "total_hours",
        frappe.datetime.get_hour_diff(frm.doc.due_time, frm.doc.on_hold_time)
      );

      frm.set_value(
        "total_days",
        frappe.datetime.get_day_diff(frm.doc.due_time, frm.doc.on_hold_time)
      );
    }
  },
});
