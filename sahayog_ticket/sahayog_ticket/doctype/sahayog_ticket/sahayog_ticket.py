# Copyright (c) 2022, Talib Sheikh and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from datetime import datetime

from frappe.utils import now_datetime, add_to_date


class SahayogTicket(Document):
    def before_save(self):
        if self.is_new():
            self.status = "Open"  # Ensure status is set for new tickets

        # if not self.employee_id:  # Only set if not already set
        #     self.set_employee_id()
    
        self.set_creation_time()
        self.track_status_change()

    def validate(self):
        if not self.status:
            self.status = "Open"
        
    def track_status_change(self):
        if not self._doc_before_save:
            return
    
        previous_status = self._doc_before_save.status
        current_status = self.status
    
        if previous_status != current_status:
            self.append("status_log", {
                "from_status": previous_status,
                "to_status": current_status,
                "status_change_by": frappe.session.user,
                "status_change_on": frappe.utils.now_datetime(),
                "status_remark": f"Status changed from {previous_status} to {current_status}"
            })
        

    def set_creation_time(self):
        creation_date_time = self.creation
        creation_datetime = self.convert_to_datetime(creation_date_time)
        creation_time = self.format_time(creation_datetime)
        self.creation_time = creation_time

    def convert_to_datetime(self, creation_date_time):
        return datetime.strptime(creation_date_time, "%Y-%m-%d %H:%M:%S.%f")

    def format_time(self, creation_datetime):
        return creation_datetime.strftime("%I:%M %p")
    
    # def set_employee_id(self):
    #     current_user = self.owner
    #     employee = frappe.get_value("Employee", {"user_id": current_user}, ["name", "employee_number"])

    #     if employee:
    #         self.employee_id = employee[1]  # Assuming employee_number is desired
    #     else:
    #         frappe.throw("No Employee record found for the current user.")

    # def before_insert(self):
    #     self.status = "Open"



@frappe.whitelist()
def get_users_by_departsection_roles(departsection):
    if not departsection:
        return []

    # Fetch roles from the child table in Departsection
    roles = frappe.get_all("Departsection Role",  # child table
        filters={"parent": departsection},
        fields=["role"]
    )

    role_names = [r.role for r in roles]

    if not role_names:
        return []

    current_user = frappe.session.user

    # Fetch users having those roles, excluding current user
    users = frappe.db.sql("""
        SELECT DISTINCT `tabUser`.name
        FROM `tabUser`
        INNER JOIN `tabHas Role` ON `tabHas Role`.parent = `tabUser`.name
        WHERE `tabHas Role`.role IN %(roles)s
        AND `tabUser`.enabled = 1
        AND `tabUser`.name NOT IN ("Guest", "Administrator")
        AND `tabUser`.name != %(current_user)s
    """, {
        "roles": tuple(role_names),
        "current_user": current_user
    })

    return [u[0] for u in users]


# This function automatically closes tickets that have been resolved for more than 48 hours.

def auto_close_resolved_tickets():
    frappe.log_error("Auto-close job triggered", "DEBUG")

    threshold_time = add_to_date(now_datetime(), minutes=-48)  # Use minutes for quick testing

    tickets = frappe.get_all("Sahayog Ticket", 
        filters={
            "status": "Resolved",
            "ticket_resolved_on": ["<", threshold_time]
        },
        fields=["name"]
    )

    frappe.log_error(f"Found {len(tickets)} tickets to close", "DEBUG")

    for ticket in tickets:
        doc = frappe.get_doc("Sahayog Ticket", ticket.name)
    
        if doc.status == "Resolved":
            frappe.log_error(f"Attempting to close Ticket: {doc.name}", "DEBUG")
            doc.status = "Closed"
    
            try:
                doc.flags.ignore_mandatory = True
                doc.flags.ignore_validate = True  # Add this too
                doc.save(ignore_permissions=True)
                frappe.db.commit()
                frappe.log_error(f"Ticket {doc.name} auto-closed successfully", "DEBUG")
            except Exception as e:
                frappe.log_error(f"Failed to auto-close ticket {doc.name}: {str(e)}", "ERROR")


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
    division
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


@frappe.whitelist()
def get_employee_info(employee_number):
    employee = frappe.get_value(
        "Employee",
        {"employee_number": employee_number},
        [
            "employee_name",
            "designation",
            "branch",
            "cell_number",
            "department",
            "custom_district",
            "custom_division",
            
        ],
        as_dict=True,
    )
    if not employee:
        return {}

    return employee

@frappe.whitelist()
def get_it_tickets():
    data = frappe.db.sql("""
        SELECT district, branch_name, COUNT(*) AS pending
        FROM `tabSahayog Ticket`
        WHERE status IN ('Open', 'In-Progress') AND dept_name = 'IT'
        GROUP BY district, branch_name
        ORDER BY district, branch_name
    """, as_dict=True)

    result = {}
    for row in data:
        district = row["district"]
        result.setdefault(district, {"district": district, "pending": 0, "branches": []})
        result[district]["branches"].append({"name": row["branch_name"], "pending": row["pending"]})
        result[district]["pending"] += row["pending"]

    return list(result.values())

# This function retrieves the zone-wise ticket counts for specific CBS-related ticket types.

@frappe.whitelist()
def get_zone():
    # Single query to fetch all CBS ticket data
    raw_data = frappe.db.sql("""
        SELECT
            ticket_type AS type,
            zone,
            status,
            assigned_to,
            COUNT(*) AS count
        FROM `tabSahayog Ticket`
        WHERE dept_name = 'CBS'
        GROUP BY ticket_type, zone, region, status, assigned_to
    """, as_dict=True)

    zone_result = {}
    executive_result = {}
    total_open = total_inprogress = total_closed = 0

    for row in raw_data:
        # ----- ZONE WISE STRUCTURE -----
        zone = row.zone or "Unknown"
        region = row.region or "Unknown Region"
        ticket_type = row.type or "Unknown Type"
        status = row.status or "Open"
        count = row.count or 0

        zone_data = zone_result.setdefault(zone, {
            "zone": zone,
            "regions": {}
        })

        region_data = zone_data["regions"].setdefault(region, {
            "region": region,
            "ticket_type": ticket_type,
            "Open": 0,
            "In-Progress": 0,
            "Closed": 0
        })

        region_data[status] += count

        if status == "Open":
            total_open += count
        elif status == "In-Progress":
            total_inprogress += count
        elif status == "Closed":
            total_closed += count

        # ----- EXECUTIVE WISE STRUCTURE -----
        executive = row.assigned_to
        if executive:
            exec_data = executive_result.setdefault(executive, {
                "executive": executive,
                "Pending": 0
            })

            if status in ("Open", "In-Progress"):
                exec_data["Pending"] += count

    # Final formatting
    zone_final = [{
        "zone": z["zone"],
        "regions": list(z["regions"].values())
    } for z in zone_result.values()]

    executive_final = list(executive_result.values())

    return {
        "zones": zone_final,
        "ticket_types": raw_data,  # Optional: could be filtered to just types if needed
        "counts": {
            "open": total_open,
            "in_progress": total_inprogress,
            "closed": total_closed
        },
        "executives": executive_final
    }
