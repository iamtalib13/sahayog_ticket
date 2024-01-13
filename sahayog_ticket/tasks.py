import frappe
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import datetime


# def send_email():
#     ob = smtplib.SMTP("smtp.office365.com", 587)
#     ob.starttls()
#     ob.login("talib.s@sahayogmultistate.com", "Ts9422817246")
#     subject = "Sending from Python"
#     body = "hello"
#     message = "Subject:{}\n\n{}".format(subject, body)
#     listOfAddress = ["talibsh16@gmail.com"]
#     ob.sendmail("talib.s@sahayogmultistate.com", listOfAddress, message)
#     print("Email sent successfully.")
#     ob.quit()


def update_tat_age():
    # Get the current date
    current_date = datetime.datetime.now().date()

    # Fetch all Sahayog Ticket records
    tickets = frappe.get_all(
        "Sahayog Ticket",
        fields=[
            "name",
            "creation",
            "status",
            "dept_name",
            "ticket_type",
            "emp_first_name",
            "emp_last_name",
        ],
    )

    for ticket in tickets:
        ticket_id = ticket.name
        creation_date = ticket.creation.date()
        dept_name = ticket.dept_name
        ticket_type = ticket.ticket_type

        # Calculate the total days since creation
        total_days = (current_date - creation_date).days

        # Concatenate first_name and last_name
        employee_name = ticket.emp_first_name + " " + ticket.emp_last_name

        frappe.db.set_value(
            "Sahayog Ticket", ticket_id, "total_days", total_days, update_modified=False
        )
        frappe.db.set_value(
            "Sahayog Ticket",
            ticket_id,
            "employee_name",
            employee_name,
            update_modified=False,
        )


    frappe.db.commit()
    print("\n\nUpdating total days and employee names\n\n")
