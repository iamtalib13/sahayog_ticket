import frappe


def execute():
    """Make authorizer ID fields Employee links on existing sites."""
    for key in ("existing_authorizer_id", "new_authorizer_id"):
        name = f"Agent Authorizer Mapping-{key}"
        if not frappe.db.exists("Request Field", name):
            continue
        doc = frappe.get_doc("Request Field", name)
        if doc.field_type != "Link" or doc.options != "Employee":
            doc.db_set("field_type", "Link", update_modified=False)
            doc.db_set("options", "Employee", update_modified=False)
