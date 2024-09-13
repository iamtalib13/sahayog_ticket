import frappe
from frappe import _
from frappe.model.document import Document
from werkzeug.wrappers import Response


class GrievancesandRedressal(Document):
    pass

@frappe.whitelist(allow_guest=True)
def submit_form():
    try:
        data = frappe.form_dict
        
        # Retrieve the anonymous checkbox value
        anonymous_checkbox_value = data.get("anonymous")
        
        # Default valuess
        sar_anonymous = 0
        employee = ""

        if "Guest" == frappe.session.user:
            user_type = "Guest"
            employee="Guest User"
        else:
            user_type = "Employee"
            # Check if the checkbox is checked
            if anonymous_checkbox_value in ["1", "on", True]:
                employee = "Anonymous"
                sar_anonymous = 1
            else:
                employee = frappe.session.user
                sar_anonymous = 0
               
        # Create a new document
        sar = frappe.new_doc("Grievances and Redressal")
        sar.ticket_type = data.get("ticket_type")
        sar.full_name = data.get("full-name")
        sar.phone = data.get("phone-number")
        sar.branch = data.get("branch")
        sar.description = data.get("description")
        sar.user_type = user_type
        sar.employee = employee
        sar.anonymous = sar_anonymous
        # Insert the document and get its name
        sar.insert()
        doc_name = sar.name
        
        # Log or use the document name
        print("Document Created", f"Document {doc_name} created successfully.")
        
        return sar_response(doc_name)
    except Exception as e:
        frappe.log_error(message=str(e), title="Form Submission Error")
        return f"<p>Error: {str(e)}</p>"


@frappe.whitelist(allow_guest=True)
def sar_response(doc_name):
    try:
        # Ensure you have the correct template path
        sar_html = frappe.render_template("templates/includes/thank_you.html", {"doc_name": doc_name})
        return Response(sar_html)
    except Exception as e:
        return Response(f"Error: {str(e)}", status=500)

@frappe.whitelist(allow_guest=True)
def get_branches():
    try:
        # Fetch all branch documents with the 'branch' field
        branches = frappe.get_all("Branch", fields=["branch"])
        
        # Ensure correct format for the response
        branch_list = [{"branch_name": branch["branch"]} for branch in branches]
        
        return {
            "branches": branch_list
        }
    except Exception as e:
        frappe.log_error(message=str(e), title="Branch Fetch Error")
        return {"error": str(e)}
    
