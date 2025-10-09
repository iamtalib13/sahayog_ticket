import frappe
from frappe import _
# API Path: /api/method/sahayog_ticket.sahayog_ticket.page.assign_role.r.assign_role_to_user

# get the user with support roles or manager roles
@frappe.whitelist()
def user_support_role_status():
    users = frappe.get_all(
        "User",
        filters={"enabled": 1},
        fields=["name", "first_name", "last_name"]
    )

    result = []
    for user in users:
        # Fetch all roles for the user
        user_roles = frappe.get_all(
            "Has Role",
            filters={"parent": user.name},
            fields=["role"],
            pluck="role"
        )

        # Separate support manager and executive roles
        manager_roles = [r for r in user_roles if "support manager" in r.lower()]
        executive_roles = [r for r in user_roles if "support executive" in r.lower()]

        # Convert flags (1 if role exists, else 0)
        support_manager = 1 if manager_roles else 0
        support_executive = 1 if executive_roles else 0

        # Skip users without either role
        if support_manager or support_executive:
            full_name = (user.first_name or "") + " " + (user.last_name or "")
            full_name = full_name.strip() or user.name

            result.append({
                "user": user.name,
                "full_name": full_name,
                "support_manager": support_manager,
                "support_executive": support_executive,
                "support_manager_roles": manager_roles,
                "support_executive_roles": executive_roles   
            })

    return result
# get role from deparsection table
@frappe.whitelist()
def get_department_roles(department_name):
    """Return only 'role' values from the child table 'department_roles' 
    for the given Departsection."""
    if not department_name:
        return {"error": "Department name is required"}

    # Fetch only required child table fields directly from DB
    roles = frappe.get_all(
        "Departsection Role",
        filters={"parent": department_name},
        fields=["role"],
        pluck="role"  # Returns a flat list of 'role' values
    )

    return {
        "department": department_name,
        "roles": roles or []
    }
# get all the users except guest and admin for popup
@frappe.whitelist()
def list_all_users():

    excluded_emails = ["guest@example.com", "admin@example.com"]
    users = frappe.get_all("User", 
        filters={
            "enabled": 1,
            "email": ["not in", excluded_emails]
        },
        fields=["name", "full_name", "email", "enabled", "user_type"]
    )
    return {
        "count": len(users),
        "users": users
    }

@frappe.whitelist()
def assign_role_to_user(email, manager_role=False, executive_role=False):
    try:
        # Step 1: Define target user
        user_email = "27@sahayog.com"

        # Step 2: Fetch roles for the user
        roles = frappe.get_all(
            "Has Role",
            filters={"parent": user_email},
            fields=["role"]
        )

        if not roles:
            return {"status": "error", "message": f"No roles found for {user_email}"}

        # Step 3: Find role that includes Support Manager or Support Executive
        selected_role = None
        for r in roles:
            if "Support Manager" in r.role or "Support Executive" in r.role:
                selected_role = r.role
                break

        if not selected_role:
            return {"status": "error", "message": f"No Support role found for {user_email}"}

        # Step 4: Extract prefix (first word, e.g., 'IT' from 'IT Support Manager')
        prefix = selected_role.split(" ")[0] if " " in selected_role else selected_role

        # Step 2: Convert string to bool
        manager_role = True if str(manager_role).lower() == "true" else False
        executive_role = True if str(executive_role).lower() == "true" else False

        # Step 3: Determine role
        if manager_role:
            final_role = f"{prefix} Support Manager"
        elif executive_role:
            final_role = f"{prefix} Support Executive"
        else:
            final_role = f"{prefix} Support Staff"

        # Step 4: Check if user exists
        if not frappe.db.exists("User", email):
            frappe.db.commit()
            frappe.local.response['message'] = {
                "show_alert": True,
                "message": f"⚠️ User {email} not found",
                "indicator": "orange"
            }
            return
        
        # Step 5: Assign role (only if not already assigned)
        user_doc = frappe.get_doc("User", email)
        if not any(r.role == final_role for r in user_doc.roles):
            user_doc.append("roles", {"role": final_role})
            user_doc.save(ignore_permissions=True)
            frappe.db.commit()
            frappe.local.response['message'] = {
                "show_alert": True,
                "message": f"✅ Role '{final_role}' assigned to {email}",
                "indicator": "green"
            }
        else:
            frappe.local.response['message'] = {
                "show_alert": True,
                "message": f"ℹ️ User {email} already has the role '{final_role}'",
                "indicator": "blue"
            }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_user_role_prefix Error")
        frappe.local.response['message'] = {
            "show_alert": True,
            "message": f"An error occurred: {str(e)}",
            "indicator": "red"
        }
        frappe.throw(f"An error occurred: {str(e)}", title="Error")

@frappe.whitelist()
def remove_user_role(email, role_to_remove):
    try:
        user = frappe.get_doc("User", {"email": email})
        if not user:
            frappe.throw(f"User {email} not found")
        # Remove role directly from list
        user.roles = [r for r in user.roles if r.role != role_to_remove]
        user.save(ignore_permissions=True)
        frappe.db.commit()
       
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "remove_user_role Error")
        frappe.throw(f"Error: {str(e)}")

