import frappe


def execute():
    if frappe.db.exists("Workspace", "Shalini & Team"):
        frappe.db.set_value(
            "Workspace", "Shalini & Team", "is_hidden", 1, update_modified=False
        )
