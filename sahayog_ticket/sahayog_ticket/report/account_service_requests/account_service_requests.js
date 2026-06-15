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
			"fieldtype": "Select",
			"options": [
				{ "value": "", "label": __("All") },
				{ "value": "Activation of Dormant account", "label": __("Activation of Dormant account") },
				{ "value": "Change of Address", "label": __("Change of Address") },
				{ "value": "DOB Updation", "label": __("DOB Updation") },
				{ "value": "MOBILE", "label": __("MOBILE") },
				{ "value": "Name Change", "label": __("Name Change") },
				{ "value": "Nomination Addition/ Deletion/ Modification", "label": __("Nomination Addition/ Deletion/ Modification") },
				{ "value": "Update Contact Number", "label": __("Update Contact Number") }
			]
		},
		{
			"fieldname": "sol_id",
			"label": __("SOL ID"),
			"fieldtype": "Link",
			"options": "Sahayog Branch"
		}
	]
};
