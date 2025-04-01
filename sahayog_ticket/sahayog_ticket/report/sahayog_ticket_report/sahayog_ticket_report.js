// Copyright (c) 2025, Talib Sheikh and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Sahayog Ticket Report"] = {
    "filters": [
        {
            "fieldname": "status",
            "label": __("Status"),
            "fieldtype": "Select",
            "options": [
				{ "value": "", "label": __("Select Status") },
                { "value": "Open", "label": __("Open") },
                { "value": "Read", "label": __("Read") },
                { "value": "In-Progress", "label": __("In-Progress") },
                { "value": "On-Hold", "label": __("On-Hold") },
                { "value": "Re-Opened", "label": __("Re-Opened") },
                { "value": "Resolved", "label": __("Resolved") },
                { "value": "Closed", "label": __("Closed") },
                { "value": "Cancelled", "label": __("Cancelled") }
            ],
            "default": "Open",
        },
        {
            "fieldname": "priority",
            "label": __("Priority"),
            "fieldtype": "Select",
            "options": [
				{ "value": "", "label": __("Select Priority") },
                { "value": "Normal", "label": __("Normal") },
                { "value": "Medium", "label": __("Medium") },
                { "value": "High", "label": __("High") },
                { "value": "Urgent", "label": __("Urgent") }
            ],
            "default": "Normal",
        },
        {
            "fieldname": "division",
            "label": __("Division"),
            "fieldtype": "Select",
            "options": [
				{ "value": "", "label": __("Select Division") },
                { "value": "Multistate", "label": __("Multistate") },
                { "value": "Microfinance", "label": __("Microfinance") },
                { "value": "Two Wheeler", "label": __("Two Wheeler") },
                { "value": "School", "label": __("School") }
            ],
            "default": "Multistate",
        },
        {
            "fieldname": "ticket_type",
            "label": __("Ticket Type"),
            "fieldtype": "Link",
            "options": "Ticket Type",
            "default": "",
        },
        {
            "fieldname": "employee_id",
            "label": __("Employee ID"),
            "fieldtype": "Data",
            "default": ""
        },
        {
            "fieldname": "employee_name",
            "label": __("Employee Name"),
            "fieldtype": "Data",
            "default": ""
        },
        {
            "fieldname": "branch_name",
            "label": __("Branch"),
            "fieldtype": "Data",
            "default": ""
        },
        {
            "fieldname": "department",
            "label": __("Department"),
            "fieldtype": "Link",
            "options": "Departsection",
            "default": ""
        }
    ]
};
