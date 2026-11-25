import frappe


def execute():
    """Allow all employees to pick an Agent in Agent Service Requests."""
    if frappe.db.exists("DocPerm", {"parent": "Agent", "role": "Employee"}):
        return

    frappe.get_doc({
        "doctype": "DocPerm",
        "parent": "Agent",
        "parenttype": "DocType",
        "parentfield": "permissions",
        "role": "Employee",
        "read": 1,
        "select": 1,
        "permlevel": 0,
    }).insert(ignore_permissions=True)
    frappe.db.commit()
