// Copyright (c) 2025, Talib Sheikh and contributors
// For license information, please see license.txt

frappe.query_reports["Account Service Requests"] = {
	"filters": [
		{
			"fieldname": "status",
			"label": __("Status"),
			"fieldtype": "Select",
			"options": "\nOpen\nIn-Progress\nResolved\nClosed"
		},
		{
			"fieldname": "response_pending",
			"label": __("Response Pending"),
			"fieldtype": "Select",
			"options": "\nPending Operations\nPending Branch\nResolved"
		},
		{
			"fieldname": "request_type",
			"label": __("Request Type"),
			"fieldtype": "Data"
		},
		{
			"fieldname": "sol_id",
			"label": __("SOL ID"),
			"fieldtype": "Data"
		}
	]
};
