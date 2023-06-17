import frappe
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_email():
    ob = smtplib.SMTP("smtp.office365.com", 587)
    ob.starttls()
    ob.login("talib.s@sahayogmultistate.com", "Ts9422817246")
    subject = "Sending from Python"
    body = "hello"
    message = "Subject:{}\n\n{}".format(subject, body)
    listOfAddress = ["talibsh16@gmail.com"]
    ob.sendmail("talib.s@sahayogmultistate.com", listOfAddress, message)
    print("Email sent successfully.")
    ob.quit()


def hourly():
    # Get the current date
    current_date = datetime.now().date()

    # Fetch all Sahayog Ticket records
    tickets = frappe.get_all(
        "Sahayog Ticket",
        fields=["name", "creation", "status", "dept_name", "ticket_type"],
    )

    for ticket in tickets:
        ticket_id = ticket.name
        creation_date = ticket.creation.date()
        dept_name = ticket.dept_name
        ticket_type = ticket.ticket_type

        # Calculate the total days since creation
        total_days = (current_date - creation_date).days

        # Check the ticket department and set the total_days field accordingly
        if ticket.status not in ["Closed", "Cancelled"]:
            if dept_name == "HR":
                if ticket.ticket_type in ["Attendance", "Medical Card", "Leave"]:
                    frappe.db.set_value(
                        "Sahayog Ticket", ticket_id, "total_days", total_days
                    )
                elif ticket.ticket_type in [
                    "PF",
                    "Salary",
                    "Form-16",
                    "ID Card",
                    "Other",
                    "Full-n-Final Settlement",
                ]:
                    frappe.db.set_value(
                        "Sahayog Ticket", ticket_id, "total_days", total_days
                    )

            elif dept_name == "IT":
                frappe.db.set_value("Sahayog Ticket", ticket_id, "total_days", "IT")
            elif dept_name == "Operations":
                frappe.db.set_value(
                    "Sahayog Ticket", ticket_id, "total_days", total_days
                )
            elif dept_name == "MIS":
                frappe.db.set_value(
                    "Sahayog Ticket", ticket_id, "total_days", total_days
                )
            elif dept_name == "JLL":
                frappe.db.set_value(
                    "Sahayog Ticket", ticket_id, "total_days", total_days
                )
            elif dept_name == "HO":
                frappe.db.set_value(
                    "Sahayog Ticket", ticket_id, "total_days", total_days
                )
            elif dept_name == "Facility":
                frappe.db.set_value(
                    "Sahayog Ticket", ticket_id, "total_days", total_days
                )
            elif dept_name == "Accounts":
                frappe.db.set_value(
                    "Sahayog Ticket", ticket_id, "total_days", total_days
                )

    frappe.db.commit()
    print("\n\nUpdating total days\n\n")
