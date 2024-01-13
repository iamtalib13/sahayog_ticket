frappe.pages['open-ticket'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Open Tickets',
		single_column: true
	});
}