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
	],
	"onload": function(report) {
		report.page.add_inner_button(__("Download Report"), function() {
			frappe.query_report.export_report();
		});
	},
	"formatter": function(value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);

		if (column.fieldname == "status") {
			let color = "";
			let bg_color = "";
			
			if (value == "Open") {
				color = "red";
				bg_color = "#ffe6e6";
			} else if (value == "In-Progress") {
				color = "orange";
				bg_color = "#fff5e6";
			} else if (value == "Resolved") {
				color = "green";
				bg_color = "#e6ffec";
			} else if (value == "Closed") {
				color = "blue";
				bg_color = "#e6f0ff";
			}

			if (color) {
				value = `<span style="
					color: ${color}; 
					background-color: ${bg_color}; 
					font-weight: bold; 
					padding: 1px 2px; 
					border-radius: 15px; 
					display: inline-block; 
					text-align: center;
					min-width: 80px;
				">${value}</span>`;
			}
		}

		return value;
	}
};
