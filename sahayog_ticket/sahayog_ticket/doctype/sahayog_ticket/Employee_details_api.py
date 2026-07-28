import frappe


@frappe.whitelist()
def check_user_divison_region(emp_id):
    return frappe.db.sql(
        """SELECT division, region, user_id FROM `tabEmployee` WHERE employee_id = %s""",
        (emp_id,),
        as_dict=True,
    )
