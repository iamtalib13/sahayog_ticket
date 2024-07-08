# Copyright (c) 2022, Talib Sheikh and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from datetime import datetime


class SahayogTicket(Document):
    def before_save(self):
        self.set_creation_time()

    def set_creation_time(self):
        creation_date_time = self.creation
        creation_datetime = self.convert_to_datetime(creation_date_time)
        creation_time = self.format_time(creation_datetime)
        self.creation_time = creation_time

    def convert_to_datetime(self, creation_date_time):
        return datetime.strptime(creation_date_time, "%Y-%m-%d %H:%M:%S.%f")

    def format_time(self, creation_datetime):
        return creation_datetime.strftime("%I:%M %p")

    def before_insert(self):
        self.status = "Open"


@frappe.whitelist()
def get_counts(employee_id):
    statuses = [
        "Open",
        "Read",
        "In-Progress",
        "On-Hold",
        "Re-Opened",
        "Resolved",
        "Closed",
        "Cancelled",
    ]
    counts = {}

    for status in statuses:
        count = frappe.db.sql(
            """SELECT COUNT(*)
               FROM `tabSahayog Ticket`
               WHERE employee_id = %s
               AND status = %s;""",
            (employee_id, status),
        )
        counts[status.lower().replace("-", "_")] = count[0][0] if count else 0

    return counts


@frappe.whitelist()
def get_emp_details(emp_id):
    return frappe.db.sql(
        f"""select department,division,region,branch,district,employee_name,cell_number,reporting_employee,reporting_employee_user_id,reporting_employee_email,reporting_person_designation,designation,first_name,last_name,user_id
        from `tabEmployee` where employee_id='{emp_id}';""",
        as_dict=True,
    )


@frappe.whitelist()
def create_asset_request(
    ticket_id,
    employee_id,
    emp_name,
    designation,
    department,
    region,
    district,
    branch,
    request_to,
    phone,
    division,
):
    try:
        # Create a new Asset Request
        doc = frappe.new_doc("Asset Request")
        doc.ticket_id = ticket_id
        doc.employee_id = employee_id
        doc.employee_user = employee_id + "@sahayog.com"
        doc.owner = employee_id + "@sahayog.com"
        doc.emp_name = emp_name
        doc.designation = designation
        doc.employee_department = department
        doc.region = region
        doc.district = district
        doc.branch = branch
        doc.select_department = request_to
        doc.phone = phone
        doc.division = division
        doc.insert(ignore_permissions=True)  # Ignore permissions to allow creation
        frappe.db.commit()  # Ensure changes are committed

        # Return the ID of the created Asset Request
        return {
            "asset_request_id": doc.name,
            "message": "Asset Request created successfully",
        }
    except Exception as e:
        frappe.log_error(f"Error creating Asset Request: {e}")
        return {"message": f"Error: {e}"}
