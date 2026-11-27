import frappe


def execute():
    """Make New Agent Code a Link to Agent and rename branch labels."""
    name = "Agent Customer Mapping-new_agent_code"
    if frappe.db.exists("Request Field", name):
        doc = frappe.get_doc("Request Field", name)
        if doc.field_type != "Link" or doc.options != "Agent":
            doc.db_set("field_type", "Link", update_modified=False)
            doc.db_set("options", "Agent", update_modified=False)
        if doc.label != "New Agent Code":
            doc.db_set("label", "New Agent Code", update_modified=False)

    # Branch labels without "New".
    for key, label in (("new_branch_code", "Branch Code"), ("new_branch_name", "Branch Name")):
        field_name = f"Agent Customer Mapping-{key}"
        if frappe.db.exists("Request Field", field_name):
            frappe.db.set_value("Request Field", field_name, "label", label, update_modified=False)

    # Branch Code is now auto-filled from the selected New Agent, so it is
    # no longer a manual Sahayog Branch link.
    name = "Agent Customer Mapping-new_branch_code"
    if frappe.db.exists("Request Field", name):
        doc = frappe.get_doc("Request Field", name)
        if doc.field_type != "Data" or (doc.options or None) is not None:
            doc.db_set("field_type", "Data", update_modified=False)
            doc.db_set("options", None, update_modified=False)
