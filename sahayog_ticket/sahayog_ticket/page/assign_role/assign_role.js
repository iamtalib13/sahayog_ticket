frappe.pages["assign-role"].on_page_load = function (wrapper) {
  frappe.ui.make_app_page({
    parent: wrapper,
    title: "Role Summary by Department",
    single_column: true,
  });

  $(wrapper).html(`
    <style>
      .page-container {
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .header {
        background: #009688;
        color: white;
        padding: 12px;
        font-weight: bold;
        border-radius: 8px 8px 0 0;
      }
      .card {
        background: white;
        border-radius: 8px;
        margin-bottom: 20px;
        border: 1px solid #e0e0e0;
      }
      .btn-primary {
        background: #009688;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
      }
      .btn-primary:hover {
        background: #00796b;
      }
      .search-box {
        padding: 15px;
        border-bottom: 1px solid #e0e0e0;
      }
      .table-container {
        padding: 15px;
        overflow-x: auto;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
      }
      .data-table th {
        background: #f5f5f5;
        padding: 12px;
        text-align: left;
        font-weight: bold;
        border-bottom: 2px solid #ddd;
      }
      .data-table td {
        padding: 12px;
        border-bottom: 1px solid #eee;
      }
      .data-table tr:hover {
        background: #f9f9f9;
      }
      .loading, .empty {
        text-align: center;
        padding: 20px;
        color: #666;
      }
      .empty { color: #999; font-style: italic; }
      .flex-row {
        display: flex;
        gap: 15px;
        align-items: center;
        margin-bottom: 15px;
      }
      .input-field {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        width: 200px;
      }
    </style>

    <div class="page-container">
      <div class="card">
        <div class="search-box">
          <div class="flex-row">
            <select id="dept_search" class="input-field">
              <option value="">Select Department</option>
            </select>
            <button id="assign_role_btn" class="btn-primary">Assign Role</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="header">Employees</div>
        <div class="table-container" id="employee_list">
          <div class="loading">Loading employees...</div>
        </div>
      </div>
      <div id="department_roles_section"></div>

    </div>
  `);

  // Fetch all employees (global variable)
  let all_users = [];

  // Load departments from Departsection doctype
  frappe.call({
    method: "frappe.client.get_list",
    args: { doctype: "Departsection", fields: ["name"] },
    callback: function (r) {
      (r.message || []).forEach((d) => {
        $("#dept_search").append(
          `<option value="${d.name}">${d.name}</option>`
        );
      });
    },
  });

  // Fetch all users initially
  function load_all_users() {
    $("#employee_list").html('<div class="loading">Loading employees...</div>');
    frappe.call({
      method:
        "sahayog_ticket.sahayog_ticket.page.assign_role.assign_role_api.user_support_role_status",
      callback: function (r) {
        all_users = r.message || [];
        render_employees(all_users);
      },
    });
  }
  // Render employee table
  function render_employees(users) {
    if (!users.length) {
      $("#employee_list").html('<div class="empty">No employees found.</div>');
      return;
    }

    let tableHtml = `
    <table class="data-table">
      <thead>
        <tr>
          <th>User ID</th>
          <th>Full Name</th>
          <th>Executive Roles</th>
          <th>Manager Roles</th>
        </tr>
      </thead>
      <tbody>
  `;

    users.forEach((user) => {
      let execRoleName =
        (user.support_executive_roles && user.support_executive_roles[0]) || "";
      let managerRoleName =
        (user.support_manager_roles && user.support_manager_roles[0]) || "";

      let executiveChecked = execRoleName ? "checked" : "";
      let managerChecked = managerRoleName ? "checked" : "";

      tableHtml += `
      <tr>
        <td>${user.user}</td>
        <td>${user.full_name}</td>
        <td style="text-align:center">
          <input type="checkbox" class="exec-role-checkbox" data-email="${user.user}" data-role="${execRoleName}" ${executiveChecked}>
        </td>
        <td style="text-align:center">
          <input type="checkbox" class="manager-role-checkbox" data-email="${user.user}" data-role="${managerRoleName}" ${managerChecked}>
        </td>
      </tr>`;
    });

    tableHtml += "</tbody></table>";
    $("#employee_list").html(tableHtml);

    // Handle executive checkbox change
    $(".exec-role-checkbox")
      .off("change")
      .on("change", function () {
        let email = $(this).attr("data-email");
        let roleName = $(this).attr("data-role") || "Executive Role";
        let checked = $(this).is(":checked");

        if (checked) {
          frappe.call({
            method:
              "sahayog_ticket.sahayog_ticket.page.assign_role.assign_role_api.assign_role_to_user",
            args: {
              email: email,
              manager_role: false,
              executive_role: true,
            },
            callback(r) {
              if (r.message) {
                frappe.show_alert({
                  message: `${email} role '${roleName}' assigned`,
                  indicator: "green",
                });
              }
            },
          });
          frappe.show_alert({
            message: `${email} ${roleName} checked`,
            indicator: "green",
          });
        } else {
          frappe.call({
            method:
              "sahayog_ticket.sahayog_ticket.page.assign_role.assign_role_api.remove_user_role",
            args: { email: email, role_to_remove: roleName },
            callback(r) {
              frappe.show_alert({
                message: `${email} role '${roleName}' removed`,
                indicator: "red",
              });
            },
          });
        }
      });

    // Handle manager checkbox change
    $(".manager-role-checkbox")
      .off("change")
      .on("change", function () {
        let email = $(this).attr("data-email");
        let roleName = $(this).attr("data-role") || "Manager Role";
        let checked = $(this).is(":checked");

        if (checked) {
          frappe.call({
            method:
              "sahayog_ticket.sahayog_ticket.page.assign_role.assign_role_api.assign_role_to_user",
            args: {
              email: email,
              manager_role: true,
              executive_role: false,
            },
            callback(r) {
              if (r.message) {
                frappe.show_alert({
                  message: `${email} role '${roleName}' assigned`,
                  indicator: "green",
                });
              }
            },
          });
          frappe.show_alert({
            message: `${email} ${roleName} checked`,
            indicator: "green",
          });
        } else {
          frappe.call({
            method:
              "sahayog_ticket.sahayog_ticket.page.assign_role.assign_role_api.remove_user_role",
            args: { email: email, role_to_remove: roleName },
            callback(r) {
              frappe.show_alert({
                message: `${email} role '${roleName}' removed`,
                indicator: "red",
              });
            },
          });
        }
      });
  }

  // Load department roles & filter users
  function load_department(department) {
    if (!department) {
      render_employees(all_users);
      return;
    }

    $("#department_roles_section").html("");
    $("#employee_list").html('<div class="loading">Filtering...</div>');

    frappe.call({
      method:
        "sahayog_ticket.sahayog_ticket.page.assign_role.assign_role_api.get_department_roles",
      args: { department_name: department },
      callback: function (res) {
        let roles = res.message?.roles || [];
        let dept = res.message?.department || department;

        // Render department role list
        let roleHtml = `
          <div class="card">
            <div class="header">Roles in ${dept}</div>
            <div class="table-container">
              <table class="data-table">
                <thead><tr><th>Role Name</th></tr></thead>
                <tbody>
        `;
        roles.forEach((role) => (roleHtml += `<tr><td>${role}</td></tr>`));
        roleHtml += "</tbody></table></div></div>";
        $("#department_roles_section").html(roleHtml);

        // Filter users by department roles
        let filtered = all_users.filter((user) => {
          let all_user_roles = [
            ...(user.support_manager_roles || []),
            ...(user.support_executive_roles || []),
          ];
          return all_user_roles.some((ur) => roles.includes(ur));
        });

        render_employees(filtered);
      },
    });
  }
  // Role assignment popup
  function showAssignRolePopup() {
    frappe.call({
      method:
        "sahayog_ticket.sahayog_ticket.page.assign_role.assign_role_api.list_all_users",
      callback: function (r) {
        let users = r.message?.users || [];

        let popupHtml = `
      <div id="assign-role-popup" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        z-index: 9999; width: 400px; max-height: 450px; overflow-y: auto;">
        <h4>Assign Role to User</h4>
        <div style="margin-bottom: 15px;">
          <label>Select User</label><br/>
          <input type="text" id="user_search" placeholder="Search user by name or email" style="width: 100%; padding: 8px; box-sizing: border-box; margin-bottom: 5px;" autocomplete="off"/>
          <div id="user_options" style="border: 1px solid #ccc; max-height: 140px; overflow-y: auto; border-radius: 4px;"></div>
          <input type="hidden" id="assign_role_user"/>
        </div>
        <div style="margin-bottom: 15px;">
          <label><input type="checkbox" id="assign_role_manager"/> Manager</label>
        </div>
        <div style="margin-bottom: 15px;">
          <label><input type="checkbox" id="assign_role_executive"/> Executive</label>
        </div>
        <div style="text-align: right;">
          <button id="assign_role_cancel" style="margin-right: 10px;">Cancel</button>
          <button id="assign_role_submit" class="btn btn-primary">Assign Role</button>
        </div>
      </div>
      <div id="assign-role-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.3); z-index: 9998;"></div>
    `;

        $("body").append(popupHtml);

        function renderOptions(filter = "") {
          let filteredUsers = users.filter((u) => {
            let combined = (u.full_name + " " + u.email).toLowerCase();
            return combined.includes(filter.toLowerCase());
          });

          let optionsHtml =
            filteredUsers
              .map(
                (u) => `
          <div class="user-option" data-name="${
            u.name
          }" style="padding: 6px 10px; cursor: pointer; border-bottom: 1px solid #eee;">
            <strong>${u.full_name || u.name}</strong><br/>
            <small style="color:#666;">${u.email}</small>
          </div>
        `
              )
              .join("") ||
            '<div style="padding:6px 10px; color:#999;">No users found</div>';

          $("#user_options").html(optionsHtml);

          $(".user-option").on("click", function () {
            let name = $(this).data("name");
            let text = $(this).find("strong").text();
            $("#assign_role_user").val(name);
            $("#user_search").val(text);
            $("#user_options").hide();
          });
        }

        renderOptions();

        $("#user_search").on("input", function () {
          let val = $(this).val();
          $("#user_options").show();
          renderOptions(val);
          $("#assign_role_user").val(""); // reset hidden input if typing
        });

        $(document).on("click.assign_role_popup", function (e) {
          if (!$(e.target).closest("#assign-role-popup").length) {
            $("#assign-role-popup, #assign-role-overlay").remove();
            $(document).off("click.assign_role_popup");
          }
        });

        $("#assign_role_cancel").on("click", function () {
          $("#assign-role-popup, #assign-role-overlay").remove();
          $(document).off("click.assign_role_popup");
        });

        $("#assign_role_submit").on("click", function () {
          let email = $("#assign_role_user").val();
          let manager_role = $("#assign_role_manager").is(":checked");
          let executive_role = $("#assign_role_executive").is(":checked");

          if (!email) {
            frappe.msgprint("Please select a user from the list.");
            return;
          }

          // Log the data sent to API for debugging
          console.log("Assign Role Data:", {
            email: email,
            manager_role: manager_role,
            executive_role: executive_role,
          });

          frappe.call({
            method:
              "sahayog_ticket.sahayog_ticket.page.assign_role.assign_role_api.assign_role_to_user",
            args: {
              email: email,
              manager_role: manager_role,
              executive_role: executive_role,
            },
            callback(r) {
              if (r.message) {
                frappe.show_alert({
                  message: "Role assigned successfully",
                  indicator: "green",
                });
                $("#assign-role-popup, #assign-role-overlay").remove();
                $(document).off("click.assign_role_popup");
                load_all_users();
              }
            },
          });
        });
      },
    });
  }

  // Event listeners
  $("#dept_search").on("click change", function () {
    let dept = $("#dept_search").val();
    load_department(dept);
  });

  $("#assign_role_btn").on("click", showAssignRolePopup);

  // Load all employees on page load
  load_all_users();
};
