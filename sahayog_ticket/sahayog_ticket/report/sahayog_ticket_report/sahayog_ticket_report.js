/**
 * Sahayog Ticket Report Configuration
 *
 * This file defines the filter configuration and client-side behavior
 * for the Sahayog Ticket Report. It includes auto-refresh functionality
 * on filter changes and proper date validation.
 *
 * Features:
 * - Comprehensive filtering options for all ticket attributes
 * - Automatic report refresh on filter changes (no Apply button needed)
 * - Date range validation and default values
 * - Proper field linking to related DocTypes
 */

frappe.query_reports["Sahayog Ticket Report"] = {
  /**
   * Filter definitions for the report
   * Each filter includes proper field types, options, and default values
   */
  filters: [
    {
      fieldname: "status",
      label: __("Status"),
      fieldtype: "Select",
      options: [
        { value: "", label: __("All") },
        { value: "Open", label: __("Open") },
        { value: "In Progress", label: __("In Progress") },
        { value: "Closed", label: __("Closed") },
      ],
      default: "",
    },
    {
      fieldname: "priority",
      label: __("Priority"),
      fieldtype: "Select",
      options: [
        { value: "", label: __("All") },
        { value: "Low", label: __("Low") },
        { value: "Medium", label: __("Medium") },
        { value: "High", label: __("High") },
      ],
      default: "",
    },
    {
      fieldname: "division",
      label: __("Division"),
      fieldtype: "Link",
      options: "Division", // Replace with actual DocType name
    },
    {
      fieldname: "ticket_type",
      label: __("Ticket Type"),
      fieldtype: "Link",
      options: "Ticket Type",
    },
    {
      fieldname: "employee_id",
      label: __("Employee ID"),
      fieldtype: "Data",
    },
    {
      fieldname: "employee_name",
      label: __("Employee Name"),
      fieldtype: "Data",
    },
    {
      fieldname: "branch_name",
      label: __("Branch Name"),
      fieldtype: "Link",
      options: "Branch", // Replace with actual DocType name
    },
    {
      fieldname: "department",
      label: __("Department"),
      fieldtype: "Link",
      options: "Department", // Replace with actual DocType name
    },
    {
      fieldname: "zone",
      label: __("Zone"),
      fieldtype: "Link",
      options: "Zone", // Replace with actual DocType name
    },
    {
      fieldname: "region",
      label: __("Region"),
      fieldtype: "Link",
      options: "Region", // Replace with actual DocType name
    },
    {
      fieldname: "assigned_to",
      label: __("Assigned To"),
      fieldtype: "Link",
      options: "User",
    },
    {
      fieldname: "from_date",
      label: __("From Date"),
      fieldtype: "Date",
      default: frappe.datetime.add_days(frappe.datetime.nowdate(), -30),
      reqd: 1,
    },
    {
      fieldname: "to_date",
      label: __("To Date"),
      fieldtype: "Date",
      default: frappe.datetime.nowdate(),
      reqd: 1,
    },
  ],

  /**
   * Initialize report functionality after loading
   * Sets up automatic refresh behavior and date validation
   *
   * @param {Object} report - The report instance
   */
  onload: function (report) {
    // Set up automatic refresh on filter changes
    this.setup_auto_refresh(report);

    // Initialize date validation
    this.setup_date_validation(report);
  },

  /**
   * Set up automatic report refresh when filters change
   * This eliminates the need for a manual "Apply" button
   *
   * @param {Object} report - The report instance
   */
  setup_auto_refresh: function (report) {
    // Override the default filter change behavior
    report.page.wrapper.find(".frappe-control").on("change", function () {
      // Add small delay to allow filter value to be set
      setTimeout(function () {
        // Validate dates before refreshing
        if (
          frappe.query_reports["Sahayog Ticket Report"].validate_date_range()
        ) {
          frappe.query_report.refresh();
        }
      }, 300);
    });
  },

  /**
   * Set up date range validation for from_date and to_date filters
   *
   * @param {Object} report - The report instance
   */
  setup_date_validation: function (report) {
    // Get date filter references
    const from_date_filter = report.get_filter("from_date");
    const to_date_filter = report.get_filter("to_date");

    // Set up validation on date changes
    if (from_date_filter && to_date_filter) {
      from_date_filter.$input.on("change", this.validate_date_range);
      to_date_filter.$input.on("change", this.validate_date_range);
    }
  },

  /**
   * Validate that from_date is not greater than to_date
   * Shows user-friendly error message if validation fails
   *
   * @returns {boolean} True if validation passes, false otherwise
   */
  validate_date_range: function () {
    const filters = frappe.query_report.get_filter_values();

    if (filters.from_date && filters.to_date) {
      if (frappe.datetime.get_diff(filters.to_date, filters.from_date) < 0) {
        frappe.msgprint({
          title: __("Date Validation Error"),
          message: __(
            "From Date cannot be greater than To Date. Please adjust your date selection."
          ),
          indicator: "red",
        });
        return false;
      }
    }
    return true;
  },

  /**
   * Format data after retrieval (optional)
   * Can be used for additional client-side data processing
   *
   * @param {Array} data - The report data
   * @returns {Array} Formatted data
   */
  formatter: function (value, row, column, data, default_formatter) {
    // Apply default formatting first
    value = default_formatter(value, row, column, data);

    // Custom formatting for specific columns
    if (column.fieldname === "status") {
      // Add color coding for status
      if (value === "Open") {
        value = `<span style="color: #ff6b6b;">${value}</span>`;
      } else if (value === "In Progress") {
        value = `<span style="color: #ffd93d;">${value}</span>`;
      } else if (value === "Closed") {
        value = `<span style="color: #6bcf7f;">${value}</span>`;
      }
    }

    if (column.fieldname === "priority") {
      // Add priority indicators
      if (value === "High") {
        value = `<span style="color: #ff4757; font-weight: bold;">${value}</span>`;
      } else if (value === "Medium") {
        value = `<span style="color: #ffa502;">${value}</span>`;
      }
    }

    return value;
  },
};
