frappe.query_reports["Sahayog Ticket Report"] = {
  onload: function () {
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
          const from = frappe.query_report.get_filter_value("from_date");
          const to = frappe.query_report.get_filter_value("to_date");
          const dateHtml = `<span style="font-size:12px; color:#6c7681; margin-left:15px; padding:4px 12px; border-radius:16px; background:#e8f0fe; color:#1a73e8; font-weight:500;">Showing data from ${from} to ${to}</span>`;
          const capsuleHtml = `<div class="department-capsules" style="margin-bottom:10px; padding:8px 15px; background:white; border-radius:8px; border:1px solid #d1d8dd; display:flex; align-items:center; flex-wrap:wrap;"><span style="font-size:12px; color:#6c7681; margin-right:8px; font-weight:600;">Departments:</span>${html}${dateHtml}</div>`;
          setTimeout(function () {
            const target = $(".page-form").length
              ? $(".page-form")
              : $(".section-body").length
              ? $(".section-body")
              : $(".reports-wrapper");
            if (target.length) {
              target.before(capsuleHtml);
            } else {
              $("body").find(".query-report").prepend(capsuleHtml);
            }
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
              } else {
                $pill.addClass("active-pill").css({
                  background: "#006767",
                  color: "white",
                  "font-weight": "700",
                });
                frappe.query_report.set_filter_value("department", dept);
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
      default: frappe.datetime.add_days(frappe.datetime.nowdate(), -30),
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
