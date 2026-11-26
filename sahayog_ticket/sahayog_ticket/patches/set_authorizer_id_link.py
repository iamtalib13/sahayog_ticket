import frappe


def execute():
    """Make New Authorizer ID an Employee link on existing sites."""
    name = "Agent Authorizer Mapping-new_authorizer_id"
    if not frappe.db.exists("Request Field", name):
        return

    doc = frappe.get_doc("Request Field", name)
    if doc.field_type == "Link" and doc.options == "Employee":
        return

    doc.db_set("field_type", "Link", update_modified=False)
    doc.db_set("options", "Employee", update_modified=False)
