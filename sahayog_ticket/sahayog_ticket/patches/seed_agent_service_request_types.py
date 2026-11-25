import frappe


TICKET_TYPE = "Agent Service Request"

# Sub type name -> [(field_key, label, field_type, options, reqd), ...]
REQUEST_TYPES = {
    "Agent Customer Mapping": [
        ("action_type", "Action Type", "Select", "Modify\nRemove", 1),
        ("branch_sol_details", "Branch / SOL Details", "Small Text", None, 0),
        ("new_agent_code", "New Agent Code", "Data", None, 0),
        ("new_agent_name", "New Agent Name", "Data", None, 0),
        ("reason", "Reason", "Small Text", None, 1),
    ],
    "Agent Authorizer Mapping": [
        ("existing_authorizer_id", "Existing Authorizer ID", "Data", None, 0),
        ("existing_authorizer_name", "Existing Authorizer Name", "Data", None, 0),
        ("new_authorizer_id", "New Authorizer ID", "Data", None, 1),
        ("new_authorizer_name", "New Authorizer Name", "Data", None, 0),
        ("effective_date", "Effective Date", "Date", None, 0),
        ("reason", "Reason", "Small Text", None, 1),
    ],
    "Agent Mobile Number Update": [
        ("existing_mobile", "Existing Mobile Number", "Data", None, 0),
        ("new_mobile", "New Mobile Number", "Data", None, 1),
        ("reason", "Reason", "Small Text", None, 1),
    ],
    "Agent SOL ID Modification": [
        ("existing_sol_id", "Existing SOL ID", "Data", None, 0),
        ("existing_branch", "Existing Branch", "Data", None, 0),
        ("new_sol_id", "New SOL ID", "Data", None, 1),
        ("new_branch", "New Branch", "Data", None, 0),
        ("reason", "Reason", "Small Text", None, 1),
    ],
    "Agent Closing Request": [
        ("closure_reason", "Closure Reason", "Small Text", None, 1),
        ("operative_account", "Operative Account Details", "Data", None, 0),
        ("savings_account", "Savings Account Details", "Data", None, 0),
        ("security_account", "Security Account Details", "Data", None, 0),
        ("dues_confirmation", "Outstanding / Dues Confirmation", "Data", None, 0),
    ],
    "Agent Account Mapping": [
        ("account_type", "Account Type", "Select", "Operative\nSavings\nSecurity", 1),
        ("existing_account_number", "Existing Account Number", "Data", None, 0),
        ("new_account_number", "New Account Number", "Data", None, 1),
        ("account_holder_name", "Account Holder Name", "Data", None, 0),
        ("reason", "Reason", "Small Text", None, 1),
    ],
    "Other Modification": [
        ("modification_category", "Modification Category", "Data", None, 1),
        ("existing_details", "Existing Details", "Small Text", None, 0),
        ("proposed_details", "Proposed / New Details", "Small Text", None, 1),
        ("reason", "Reason", "Small Text", None, 1),
    ],
}

# names used by the earlier (removed) code-based schema
OLD_NAMES = [
    "AGENT_CUSTOMER_MAPPING",
    "AGENT_AUTHORIZER_MAPPING",
    "AGENT_MOBILE_UPDATE",
    "AGENT_SOL_MODIFICATION",
    "AGENT_CLOSING_REQUEST",
    "AGENT_ACCOUNT_MAPPING",
    "OTHER_MODIFICATION",
    "AGENT_CONTACT_UPDATE",
]


def execute():
    for old in OLD_NAMES:
        frappe.db.delete("Request Field", {"service_request_sub_type": old})
        if frappe.db.exists("Service Request Sub Type", old):
            frappe.db.delete("Service Request Sub Type", old)

    for name, fields in REQUEST_TYPES.items():
        if not frappe.db.exists("Service Request Sub Type", name):
            frappe.get_doc({
                "doctype": "Service Request Sub Type",
                "sub_type_name": name,
                "ticket_type": TICKET_TYPE,
                "is_active": 1,
            }).insert(ignore_permissions=True)

        for key, label, ftype, options, reqd in fields:
            field_name = f"{name}-{key}"
            if frappe.db.exists("Request Field", field_name):
                continue
            frappe.get_doc({
                "doctype": "Request Field",
                "field_key": key,
                "label": label,
                "field_type": ftype,
                "options": options,
                "service_request_sub_type": name,
                "reqd": reqd,
                "is_active": 1,
            }).insert(ignore_permissions=True)

    frappe.db.commit()
