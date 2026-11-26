import frappe


def execute():
    """Link Existing Authorizer ID to Employee on sites where the earlier patch ran."""
    name = "Agent Authorizer Mapping-existing_authorizer_id"
    if not frappe.db.exists("Request Field", name):
        return

    doc = frappe.get_doc("Request Field", name)
    if doc.field_type != "Link" or doc.options != "Employee":
        doc.db_set("field_type", "Link", update_modified=False)
        doc.db_set("options", "Employee", update_modified=False)
