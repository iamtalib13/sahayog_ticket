# import frappe


# @frappe.whitelist()
# def update_tat(ticket_id, days):
#     # Update the 'total_days' field using frappe.db.set_value
#     frappe.db.set_value(
#         "Sahayog Ticket", ticket_id, "total_days", days, update_modified=False
#     )

#     return "Total days updated successfully."
