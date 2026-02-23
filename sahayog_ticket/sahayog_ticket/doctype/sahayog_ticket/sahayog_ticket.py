
# Copyright (c) 2022, Talib Sheikh and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from datetime import datetime

from frappe.utils import now_datetime, add_to_date
from frappe.utils.password import update_password
from frappe import _


class SahayogTicket(Document):
    def onload(self):
        if self.request_detail is None:
            self.request_detail = []
        if self.status_log is None:
            self.status_log = []

    def before_save(self):   
        #self.set_creation_time()
        self.track_status_change()
        self.set_employee_id()
        self.notify_branch_on_resolution()

# sends email notification to branch when ticket is marked as Resolved or Closed
# with fallback logic to find branch email by sol_id or branch name.
    def notify_branch_on_resolution(self):
        # 1. Ensure we have an employee_id to work with
        emp_id = self.employee_id
        if not emp_id and self.owner:
            emp_id = frappe.db.get_value("Employee", {"user_id": self.owner}, "employee_number")

        if not emp_id:
            return

        # 2. Check if status is Resolved or Closed and ticket type is Account Service Request
        if self.status in ["Resolved", "Closed"] and self.ticket_type == "Account Service Request":
            is_status_changed = False
            if not self._doc_before_save:
                is_status_changed = True
            elif self._doc_before_save.status != self.status:
                is_status_changed = True

            if is_status_changed:
                # 3. Get Employee's branch info
                emp_data = frappe.db.get_value("Employee", {"employee_number": emp_id}, ["sol_id", "sahayog_branch"], as_dict=True)
                
                branch_email = None
                if emp_data:
                    # Try finding email by sol_id first
                    if emp_data.sol_id:
                        branch_email = frappe.db.get_value("Sahayog Branch", {"sol_id": emp_data.sol_id}, "email")
                    
                    # Fallback to finding by branch name (sahayog_branch)
                    if not branch_email and emp_data.sahayog_branch:
                        branch_email = frappe.db.get_value("Sahayog Branch", {"branch": emp_data.sahayog_branch}, "email")

                if branch_email:
                    subject = _("Ticket {0} has been {1}").format(self.name, self.status)
                    
                    # Fetch employee info for the card
                    emp_info = frappe.get_value(
                        "Employee",
                        {"employee_number": emp_id},
                        ["employee_name", "designation", "branch", "department"],
                        as_dict=True
                    ) or {}

                    message = f"""
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #444; max-width: 800px; margin: auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                            <div style="background-color: {'#28a745' if self.status == 'Resolved' else '#006767'}; color: #ffffff; padding: 20px; text-align: center;">
                                <h2 style="margin: 0; font-size: 24px;">Ticket {self.status}</h2>
                                <p style="margin: 5px 0 0; opacity: 0.9;">Ticket ID: {self.name}</p>
                            </div>
                            
                            <div style="padding: 25px; background-color: #ffffff;">
                                <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 5px solid #087b74;">
                                    <p style="margin: 0; font-size: 16px;">The ticket submitted by <b>{emp_info.get('employee_name', 'Employee')}</b> has been marked as <b>{self.status}</b>.</p>
                                    {f'<p style="margin: 10px 0 0;"><b>Resolution Remark:</b> {self.resolved_remark}</p>' if self.status == "Resolved" and self.resolved_remark else ''}
                                    {f'<p style="margin: 10px 0 0;"><b>Closing Remark:</b> {self.close_remark}</p>' if self.status == "Closed" and self.close_remark else ''}
                                </div>

                                <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between;">
                                    <div style="flex: 1; min-width: 300px; background: #f8fbfb; padding: 20px; border-radius: 10px; border: 1px solid #d1e8e8;">
                                        <h4 style="color: #006767; margin-top: 0; border-bottom: 2px solid #006767; padding-bottom: 8px; display: inline-block;">Ticket Summary</h4>
                                        <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-top: 10px;">
                                            <tr><td style="padding: 5px 0; color: #666;"><b>Issue Type:</b></td><td style="padding: 5px 0;">{self.ticket_type}</td></tr>
                                            <tr><td style="padding: 5px 0; color: #666;"><b>Department:</b></td><td style="padding: 5px 0;">{self.dept_name}</td></tr>
                                            <tr><td style="padding: 5px 0; color: #666;"><b>Branch:</b></td><td style="padding: 5px 0;">{emp_info.get('branch', 'Not specified')}</td></tr>
                                        </table>
                                    </div>
                                </div>

                                <div style="margin-top: 25px; padding-top: 15px; border-top: 1px dashed #ddd; text-align: center; font-size: 12px; color: #888;">
                                    <p>This is an automated status update from Sahayog Ticket System.</p>
                                </div>
                            </div>
                        </div>
                    """

                    frappe.sendmail(
                        recipients=[branch_email],
                        subject=subject,
                        message=message,
                        now=True
                    )

    def after_insert(self):
        if self.ticket_type == "Account Service Request" and self.status == "Open":
            self.send_account_service_request_email()
# This method sends a detailed email notification when a new Account Service Request ticket is created, 
# including employee details and ticket summary in a visually appealing format.
    def send_account_service_request_email(self):
        # Fetch employee details for the intro section
        emp_info = frappe.get_value(
            "Employee",
            {"employee_number": self.employee_id},
            ["employee_name", "designation", "branch", "department", "custom_division", "cell_number", "company_email"],
            as_dict=True
        )

        if not emp_info and self.owner:
            # Fallback to fetching by user_id if employee_number didn't match
            emp_info = frappe.get_value(
                "Employee",
                {"user_id": self.owner},
                ["employee_name", "designation", "branch", "department", "custom_division", "cell_number", "company_email"],
                as_dict=True
            ) or {}

        subject = _("New Account Service Request: {0}").format(self.name)
        
        # Get Assigned To User Name
        assigned_to_name = self.assigned_to_name or "NO Executive assigned."
        
        # Construct HTML message with a two-column card layout
        intro_details = f"""
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #444; max-width: 800px; margin: auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <div style="background-color: #006767; color: #ffffff; padding: 20px; text-align: center;">
                    <h2 style="margin: 0; font-size: 24px;">Account Service Request</h2>
                    <p style="margin: 5px 0 0; opacity: 0.9;">Ticket ID: {self.name}</p>
                </div>
                
                <div style="padding: 25px; background-color: #ffffff;">
                    <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between;">
                        
                        <!-- Employee Info Card -->
                        <div style="flex: 1; min-width: 300px; background: #f8fbfb; padding: 20px; border-radius: 10px; border: 1px solid #d1e8e8;">
                            <h4 style="color: #006767; margin-top: 0; border-bottom: 2px solid #006767; padding-bottom: 8px; display: inline-block;">Employee Details</h4>
                            <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-top: 10px;">
                                <tr><td style="padding: 5px 0; color: #666;"><b>Name:</b></td><td style="padding: 5px 0;">{emp_info.get('employee_name', 'Not specified')}</td></tr>
                                <tr><td style="padding: 5px 0; color: #666;"><b>ID:</b></td><td style="padding: 5px 0;">{self.employee_id or 'N/A'}</td></tr>
                                <tr><td style="padding: 5px 0; color: #666;"><b>Designation:</b></td><td style="padding: 5px 0;">{emp_info.get('designation', 'Not specified')}</td></tr>
                                <tr><td style="padding: 5px 0; color: #666;"><b>Branch:</b></td><td style="padding: 5px 0;">{emp_info.get('branch', 'Not specified')}</td></tr>
                                <tr><td style="padding: 5px 0; color: #666;"><b>Division:</b></td><td style="padding: 5px 0;">{emp_info.get('custom_division', 'Not specified')}</td></tr>
                                <tr><td style="padding: 5px 0; color: #666;"><b>Phone:</b></td><td style="padding: 5px 0;">{emp_info.get('cell_number', 'Not available')}</td></tr>
                            </table>
                        </div>

                        <!-- Ticket Info Card -->
                        <div style="flex: 1; min-width: 300px; background: #fff9f2; padding: 20px; border-radius: 10px; border: 1px solid #ffe8cc;">
                            <h4 style="color: #d97706; margin-top: 0; border-bottom: 2px solid #d97706; padding-bottom: 8px; display: inline-block;">Ticket Summary</h4>
                            <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-top: 10px;">
                                <tr><td style="padding: 5px 0; color: #666;"><b>Department:</b></td><td style="padding: 5px 0;">{self.dept_name}</td></tr>
                                <tr><td style="padding: 5px 0; color: #666;"><b>Issue Type:</b></td><td style="padding: 5px 0;">{self.ticket_type}</td></tr>
                                <tr><td style="padding: 5px 0; color: #666;"><b>TAT:</b></td><td style="padding: 5px 0;">{self.tat or 'N/A'}</td></tr>
                                <tr><td style="padding: 5px 0; color: #666;"><b>Status:</b></td><td style="padding: 5px 0;"><span style="background: #006767; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">{self.status}</span></td></tr>
                                <tr><td style="padding: 5px 0; vertical-align: top; color: #666;"><b>Description:</b></td><td style="padding: 5px 0; font-size: 13px;">{self.description}</td></tr>
                                <tr><td style="padding: 5px 0; color: #666;"><b>Assigned To:</b></td><td style="padding: 5px 0;">{assigned_to_name}</td></tr>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top: 25px; padding-top: 15px; border-top: 1px dashed #ddd; text-align: center; font-size: 12px; color: #888;">
                        <p>This is an automated request notification from Sahayog Multi-state. Please do not reply to this email.</p>
                    </div>
                </div>
            </div>
        """

        frappe.sendmail(
            recipients=["Accountservicing@sahayogmultistate.com"],
            subject=subject,
            message=intro_details,
            now=True
        )

    def set_employee_id(self):
        if self.owner and not self.employee_id:
            emp_info = frappe.db.get_value("Employee", {"user_id": self.owner}, ["employee_number"], as_dict=True)
            if emp_info and emp_info.employee_number:
                self.employee_id = emp_info.employee_number

    def validate(self):
        self.validate_request_detail()
        self.check_account_validation()
        self.validate_contact_number_update()

    
    def check_account_validation(self):
        import re

        # Regex patterns
        mobile_pattern = r"^[6-9]\d{9}$"                 # 10-digit Indian mobile
        pan_pattern = r"^[A-Z]{5}[0-9]{4}[A-Z]$"         # PAN Format ABCDE1234F
        email_pattern = r"^[\w\.-]+@[\w\.-]+\.\w+$"      # Basic email structure

        for row in self.request_detail:

            # -------------------------------------------
            # 1️⃣ REQUIRED FIELD VALIDATIONS BASED ON REQUEST TYPE
            # -------------------------------------------
            if row.request_type == "Change of Address" and not row.new_address:
                frappe.throw(_("Row #{0}: New Address is required").format(row.idx))

            if row.request_type == "Update Contact Number" and not row.new_contact_number:
                frappe.throw(_("Row #{0}: New Contact Number is required").format(row.idx))

            if row.request_type == "Update Email Address" and not row.new_email:
                frappe.throw(_("Row #{0}: New Email Address is required").format(row.idx))

            if row.request_type == "Update KYC (Adhaar/Voter/Passport/etc)" and not row.new_kyc_no:
                frappe.throw(_("Row #{0}: New KYC No is required").format(row.idx))

            if row.request_type == "Update PAN NO" and not row.new_pan_no:
                frappe.throw(_("Row #{0}: New PAN No is required").format(row.idx))


            # -------------------------------------------
            # 2️⃣ FORMAT VALIDATION (IF FIELD HAS VALUE)
            # -------------------------------------------

            # Validate new_contact_number (if present)
            if row.new_contact_number:
                if not re.match(mobile_pattern, row.new_contact_number):
                    frappe.throw(
                        _("Row #{0}: Enter valid 10-digit Indian Mobile Number").format(row.idx)
                    )

            # Validate new_pan_no (if present)
            if row.new_pan_no:
                if not re.match(pan_pattern, row.new_pan_no.upper()):
                    frappe.throw(
                        _("Row #{0}: Enter valid PAN Number (Format: ABCDE1234F)").format(row.idx)
                    )

            # Validate new_email (if present)
            if row.new_email:
                if not re.match(email_pattern, row.new_email):
                    frappe.throw(
                        _("Row #{0}: Enter valid Email Address").format(row.idx)
                    )
    
    def validate_request_detail(self):
        # Check only when ticket type is Account Service Request
        if self.ticket_type == "Account Service Request":
            row_count = len(self.request_detail or [])

            # No rows added
            if row_count == 0:
                frappe.throw(
                    "Please add one Request Detail for Account Service Request.",
                    title="Account Detail Required"
                )

            # More than one row added
            if row_count > 1:
                frappe.throw(
                    "Only one Account Request Detail is allowed for Account Service Request.",
                    title="Multiple Request Details Not Allowed"
                )

    def validate_contact_number_update(self):
                # Loop through child table rows
        for row in self.request_detail or []:
            if row.request_type == "Update Contact Number":
                if row.contact_number and row.new_contact_number:
                    if row.contact_number == row.new_contact_number:
                        frappe.throw(
                            f"Row {row.idx}: New Contact Number must be different from the existing Contact Number."
                        )

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
def create_asset_request(ticket_id, employee_id, request_to, emp_name=None, designation=None, department=None, region=None, district=None, branch=None, phone=None, division=None, **kwargs):
    try:
        # Get employee info - ONLY EXISTING COLUMNS
        emp_info = frappe.db.get_value(
            "Employee",
            {"employee_number": employee_id},
            [
                "employee_name",
                "designation",
                "department",
                "custom_region",
                "custom_district",
                "branch",
                "cell_number",
                "custom_division"
            ],
            as_dict=True,
        )

        if not emp_info:
            frappe.throw(f"Employee {employee_id} not found")

        # Create new Asset Request
        doc = frappe.new_doc("Asset Request")
        
        # Basic fields
        doc.ticket_id = ticket_id
        doc.employee_id = employee_id
        doc.select_department = request_to
        
        # User email
        user_email = f"{employee_id}@sahayog.com"
        doc.employee_user = user_email
        doc.owner = user_email

        # 🔥 SAFE DEFAULTS - NO LINK VALIDATION ERRORS
        doc.emp_name = emp_info.employee_name or "Not specified"
        doc.designation = emp_info.designation or "Employee"
        doc.employee_department = emp_info.department or "Operations"
        doc.region = emp_info.custom_region or "Head Office"
        doc.district = emp_info.custom_district or ""
        doc.branch = emp_info.branch or "GONDIA HO"
        doc.phone = emp_info.cell_number or ""
        doc.division = emp_info.custom_division or "Multistate"  # ✅ TEXT VALUE ONLY

        # 🔥 ULTIMATE VALIDATION BYPASS
        doc.flags.ignore_validate = True
        doc.flags.ignore_validate_update_after_submit = True
        doc.flags.ignore_mandatory = True
        doc.flags.ignore_links = True  # ✅ KILLS division link error
        doc.flags.ignore_validate_optional = True
        doc.flags.ignore_permissions = True

        # Insert & Commit
        doc.insert()
        frappe.db.commit()

        frappe.msgprint(f"✅ Asset Request Created: {doc.name}", "Success")

        return {
            "asset_request_id": doc.name,
            "message": "Record created successfully with all validations bypassed"
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Asset Request Error")
        frappe.throw(f"Error: {str(e)}")

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
@frappe.whitelist()
@frappe.whitelist()
def get_it_tickets():
    # Fetch all IT tickets with geographic info and employee details
    data = frappe.db.sql("""
        SELECT 
            t.name,
            t.district, 
            t.branch, 
            t.sol_id,
            t.status,
            t.priority,
            t.creation,
            t.owner,
            t.assigned_to,
            t.assigned_to_name,
            t.ticket_type,
            t.dept_name,
            t.tat,
            e.employee_name,
            e.cell_number,
            e.designation,
            COALESCE(b.state, 'Unknown State') as state,
            COALESCE(b.zone, 'Unknown Zone') as zone,
            COALESCE(b.region, 'Unknown Region') as region
        FROM `tabSahayog Ticket` t
        LEFT JOIN `tabEmployee` e ON t.employee_id = e.name
        LEFT JOIN `tabSahayog Branch` b ON t.sol_id = b.sol_id
        WHERE t.status IN ('Open', 'In-Progress') AND t.dept_name = 'IT'
        ORDER BY t.creation DESC
    """, as_dict=True)

    return data

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
# sahayog ticket assigned_to logic
# API Path: /api/method/sahayog_ticket.sahayog_ticket.doctype.sahayog_ticket.sahayog_ticket.get_it_support_executives

@frappe.whitelist()
def get_it_support_executives(doctype=None, txt=None, searchfield=None, filters=None):
    filters = frappe.parse_json(filters) if filters else {}
    dept_name = filters.get("dept_name")


    roles = []
    try:
        departsection = frappe.get_doc("Departsection", dept_name)
        roles = [d.role for d in getattr(departsection, "department_roles", [])]
    except frappe.DoesNotExistError:
        roles = []
    except Exception as e:
        frappe.log_error(message=str(e), title="Error fetching roles in get_it_support_executives")
        roles = []

    user_list = []
    if roles:
        user_ids = [ur.parent for ur in frappe.get_all("Has Role", filters={"role": ["in", roles]}, fields=["parent"])]
        if user_ids:
            user_records = frappe.get_all(
                "User",
                filters={"email": ["in", user_ids], "name": ["!=", "Administrator"],"enabled": 1},
                fields=["name", "full_name",],
                limit_page_length=0,
            )
            txt = (txt or "").lower()

            assigned_counts = frappe.get_all(
                "Sahayog Ticket",
                filters={
                    "assigned_to": ["in", user_ids],
                    "status": ["not in", ["Resolved", "Closed"]]
                },
                fields=["assigned_to", "count(name) as count"],
                group_by="assigned_to"
            )

            counts_map = {a.assigned_to: a.count for a in assigned_counts}

            for user in user_records:
                if txt in user.name.lower() or (user.full_name and txt in user.full_name.lower()):
                    count = counts_map.get(user.name, 0)
                    label = f"{user.full_name or user.name} ({count} tickets assigned)"
                    user_list.append((user.name, label))

    return user_list

@frappe.whitelist()
def get_user_details(username):
    """
    Takes 'username' as input, checks if it exists in the User doctype,
    and returns the user's full_name and email.
    """
    user = frappe.db.get_value(
        "User",
        {"username": username},
        ["full_name", "email"],
        as_dict=True
    )

    if not user:
        frappe.throw(f"No user found with username: {username}")

    return user

@frappe.whitelist(allow_guest=False)
def reset_user_password(email, new_password):
    try:
        user_name = frappe.db.get_value("User", {"email": email}, "name")
        if not user_name:
            return {"message": "error: User not found"}

        update_password(user_name, new_password)
        frappe.db.commit()
        return {"message": "success"}

    except Exception as e:
        frappe.log_error(f"Password reset failed for {email}: {str(e)}", "Password Reset Error")
        return {"message": f"error: {str(e)}"}

@frappe.whitelist()
def get_recent_ticket_comments(limit=10):
    limit = int(limit)
    user = frappe.session.user

    return frappe.db.sql("""
        SELECT
            c.reference_name  AS ticket_name,
            c.content         AS comment_content,
            c.owner           AS commented_by,
            c.creation        AS comment_time
        FROM `tabComment` c
        INNER JOIN `tabSahayog Ticket` t
            ON t.name = c.reference_name
        WHERE
            c.reference_doctype = 'Sahayog Ticket'
            AND c.comment_type = 'Comment'
            AND t.owner = %s
        ORDER BY c.creation DESC
        LIMIT %s
    """, (user, limit), as_dict=True)