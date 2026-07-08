frappe.query_reports["Sahayog Ticket Report"] = {
  onload: function (report) {
    report.page.add_inner_button("Download", function () {
      const d = new frappe.ui.Dialog({
        title: "Export Report",
        fields: [
          {
            label: "File Format",
            fieldname: "file_format",
            fieldtype: "Select",
            options: "XLSX\nCSV",
            default: "XLSX",
            reqd: 1,
          },
        ],
        primary_action_label: "Export",
        primary_action(values) {
          const format = values.file_format;
          const filters = frappe.query_report.get_filter_values();
          const data = frappe.query_report.data || [];
          const visible_idx = data.map((_, i) => i);
          const args = {
            report_name: "Sahayog Ticket Report",
            file_format_type: format === "XLSX" ? "Excel" : format,
            filters: JSON.stringify(filters),
            visible_idx: JSON.stringify(visible_idx),
            include_indentation: 0,
            include_filters: 1,
            custom_columns: "[]",
            include_hidden_columns: 0,
          };
          open_url_post("/api/method/frappe.desk.query_report.export_query", args);
          d.hide();
        },
      });
      d.show();
    });
    const isHOUser =
      frappe.session.user === "Administrator" ||
      frappe.user.has_role("HO Support Executive") ||
      frappe.user.has_role("HO Support Manager");

    if (!isHOUser) {
      frappe.call({
        method: "sahayog_ticket.sahayog_ticket.report.sahayog_ticket_report.sahayog_ticket_report.get_employee_department",
        args: { user: frappe.session.user },
        callback: function (r) {
          if (r.message) {
            frappe.query_report.set_filter_value("department", r.message);
            setTimeout(function () {
              const deptFilter = report.get_filter("department");
              if (deptFilter) {
                deptFilter.$input.prop("disabled", true);
              }
            }, 500);
          }
        },
        async: false,
      });
    }

    frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Departsection",
        fields: ["dept_name"],
        limit_page_length: 0,
      },
      callback: function (r) {
        if (r.message) {
          const depts = r.message.map((d) => d.dept_name);
          const html = depts
            .map(
              (d) =>
                `<span class="department-pill" data-dept="${d}" style="cursor:pointer; margin:2px; padding:4px 12px; border-radius:16px; background:rgba(0,0,0,0.1); color:rgb(51,51,51); font-size:12px; font-weight:500;">${d}</span>`
            )
            .join("");
          function formatDate(d) {
            if (!d) return "";
            const parts = d.split("-");
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          function updateDateCapsule() {
            const from = formatDate(frappe.query_report.get_filter_value("from_date"));
            const to = formatDate(frappe.query_report.get_filter_value("to_date"));
            const dateText = `Showing data from ${from} to ${to}`;
            if ($(".date-range-capsule").length) {
              $(".date-range-capsule").text(dateText);
            }
          }
          const from = formatDate(frappe.query_report.get_filter_value("from_date"));
          const to = formatDate(frappe.query_report.get_filter_value("to_date"));
          const dateHtml = `<span class="date-range-capsule" style="font-size:12px; color:#6c7681; margin-left:15px; padding:4px 12px; border-radius:16px; background:#e8f0fe; color:#1a73e8; font-weight:500;">Showing data from ${from} to ${to}</span>`;
          const capsuleHtml = `<div class="department-capsules" style="margin-bottom:10px; padding:8px 15px; background:white; border-radius:8px; border:1px solid #d1d8dd; display:flex; align-items:center; flex-wrap:wrap;"><span style="font-size:12px; color:#6c7681; margin-right:8px; font-weight:600;">Departments:</span>${html}${dateHtml}</div>`;
          const statuses = [
            { name: "Open", color: "#2490ef" },
            { name: "In-Progress", color: "#f59f00" },
            { name: "Resolved", color: "#28a745" },
            { name: "Closed", color: "#98a6ad" },
          ];
          function fetchStatusCounts(dept) {
            frappe.call({
              method: "sahayog_ticket.sahayog_ticket.report.sahayog_ticket_report.sahayog_ticket_report.get_status_counts",
              args: {
                department: dept || "",
                from_date: frappe.query_report.get_filter_value("from_date") || "",
                to_date: frappe.query_report.get_filter_value("to_date") || "",
              },
              callback: function (r) {
                if (r.message) {
                  const counts = r.message;
                  statuses.forEach((s) => {
                    const $pill = $(`.status-pill[data-status="${s.name}"]`);
                    const count = counts[s.name] || 0;
                    $pill.find(".status-count").text(count);
                  });
                }
              },
            });
          }
          const statusHtml = statuses
            .map(
              (s) =>
                `<span class="status-pill" data-status="${s.name}" style="cursor:pointer; margin:2px; padding:4px 12px; border-radius:16px; background:${s.color}; color:white; font-size:12px; font-weight:500;">${s.name} <span class="status-count" style="background:rgba(0,0,0,0.2); padding:1px 6px; border-radius:10px; font-size:11px; margin-left:4px;">0</span></span>`
            )
            .join("");
          const statusCapsuleHtml = `<div class="status-capsules" style="margin-bottom:10px; padding:8px 15px; background:white; border-radius:8px; border:1px solid #d1d8dd; display:flex; align-items:center; flex-wrap:wrap;"><span style="font-size:12px; color:#6c7681; margin-right:8px; font-weight:600;">Status:</span>${statusHtml}</div>`;
          setTimeout(function () {
            const target = $(".page-form").length
              ? $(".page-form")
              : $(".section-body").length
              ? $(".section-body")
              : $(".reports-wrapper");
            if (target.length) {
              target.before(capsuleHtml + statusCapsuleHtml);
            } else {
              $("body").find(".query-report").prepend(capsuleHtml + statusCapsuleHtml);
            }
            $(document).on("change", "[data-fieldname='from_date'], [data-fieldname='to_date']", function () {
              updateDateCapsule();
              fetchStatusCounts(frappe.query_report.get_filter_value("department"));
            });
            const activeDept = frappe.query_report.get_filter_value("department");
            fetchStatusCounts(activeDept);
            if (activeDept) {
              $(`.department-pill[data-dept="${activeDept}"]`).addClass("active-pill").css({
                background: "#006767",
                color: "white",
                "font-weight": "700",
              });
            }
            const activeStatus = frappe.query_report.get_filter_value("status");
            if (activeStatus) {
              const sColor = statuses.find((s) => s.name === activeStatus);
              $(`.status-pill[data-status="${activeStatus}"]`).addClass("active-status-pill").css({
                background: sColor ? sColor.color : "#006767",
                color: "white",
                "font-weight": "700",
                "box-shadow": "0 0 8px rgba(0,0,0,0.4)",
              });
            }
            if (!isHOUser) {
              $(".department-pill").css({
                cursor: "not-allowed",
                opacity: "0.5",
              });
            } else {
              $(document).on("click", ".department-pill", function () {
                const $pill = $(this);
                const dept = $pill.data("dept");
                const isActive = $pill.hasClass("active-pill");
                $(".department-pill").removeClass("active-pill").css({
                  background: "rgba(0,0,0,0.1)",
                  color: "rgb(51,51,51)",
                  "font-weight": "500",
                });
                if (isActive) {
                  frappe.query_report.set_filter_value("department", "");
                  fetchStatusCounts("");
                } else {
                  $pill.addClass("active-pill").css({
                    background: "#006767",
                    color: "white",
                    "font-weight": "700",
                  });
                  frappe.query_report.set_filter_value("department", dept);
                  fetchStatusCounts(dept);
                }
              });
            }
            $(document).on("click", ".status-pill", function () {
              const $pill = $(this);
              const status = $pill.data("status");
              const isActive = $pill.hasClass("active-status-pill");
              const sColor = statuses.find((s) => s.name === status);
              $(".status-pill").removeClass("active-status-pill").each(function () {
                const sName = $(this).data("status");
                const sObj = statuses.find((s) => s.name === sName);
                $(this).css({
                  background: sObj ? sObj.color : "#98a6ad",
                  color: "white",
                  "font-weight": "500",
                  "box-shadow": "none",
                });
              });
              if (isActive) {
                frappe.query_report.set_filter_value("status", "");
              } else {
                $pill.addClass("active-status-pill").css({
                  background: sColor ? sColor.color : "#006767",
                  color: "white",
                  "font-weight": "700",
                  "box-shadow": "0 0 8px rgba(0,0,0,0.4)",
                });
                frappe.query_report.set_filter_value("status", status);
              }
            });
          }, 1000);
        }
      },
    });
  },
  // Filter definitions for report data filtering
  filters: [
    {
      fieldname: "from_date",
      label: "From Date",
      fieldtype: "Date",
      default: frappe.datetime.month_start(),
      reqd: 1,
    },
    {
      fieldname: "to_date",
      label: "To Date",
      fieldtype: "Date",
      default: frappe.datetime.nowdate(),
      reqd: 1,
    },
    {
      fieldname: "status",
      label: "Status",
      fieldtype: "Select",
      options: "\nOpen\nIn-Progress\nResolved\nClosed",
      default: "",
    },
    {
      fieldname: "priority",
      label: "Priority",
      fieldtype: "Select",
      options: "\nLow\nMedium\nHigh",
      default: "",
    },
    {
      fieldname: "division",
      label: "Division",
      fieldtype: "Data",
    },
    {
      fieldname: "ticket_type",
      label: "Ticket Type",
      fieldtype: "Link",
      options: "Ticket Type",
    },
    {
      fieldname: "employee_id",
      label: "Employee ID",
      fieldtype: "Data",
    },
    {
      fieldname: "employee_name",
      label: "Employee Name",
      fieldtype: "Data",
    },
    {
      fieldname: "branch_name",
      label: "Branch Name",
      fieldtype: "Link",
      options: "Branch",
    },
    {
      fieldname: "department",
      label: "Ticket Department",
      fieldtype: "Link",
      options: "Departsection",
    },
    {
      fieldname: "zone",
      label: "Zone",
      fieldtype: "Link",
      options: "Zone",
    },
    {
      fieldname: "region",
      label: "Region",
      fieldtype: "Link",
      options: "Region",
    },
    {
      fieldname: "assigned_to",
      label: "Assigned To",
      fieldtype: "Link",
      options: "User",
    },
  ],
};
