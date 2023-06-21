import frappe


@frappe.whitelist()
def check_user_divison_region(emp_id):
    return frappe.db.sql(
        f"""select division,region,user_id from `tabEmployee` where employee_id='{emp_id}';""",
        as_dict=True,
    )
