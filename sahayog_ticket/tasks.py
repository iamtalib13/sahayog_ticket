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
import datetime

def update_tat_age():
    try:
        # Get the current datetime
        current_datetime = datetime.datetime.now()

        # Fetch all Sahayog Ticket records where status is not "Closed" or "Cancelled"
        tickets = frappe.get_all(
            "Sahayog Ticket",
            filters={"status": ["not in", ["Closed", "Cancelled"]]},
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

        # Initialize a counter for updated records
        updated_records_count = 0

        for ticket in tickets:
            ticket_id = ticket.name
            creation_datetime = ticket.creation
            creation_time = creation_datetime.strftime("%I:%M %p")  # Format HH:MM AM/PM
            dept_name = ticket.dept_name
            ticket_type = ticket.ticket_type

            # Calculate the total days since creation
            total_days = (current_datetime.date() - creation_datetime.date()).days

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
            
            frappe.db.set_value(
                "Sahayog Ticket", ticket_id, "creation_time", creation_time, update_modified=False
            )

            # Increment the counter
            updated_records_count += 1

        frappe.db.commit()

        # Print the number of records updated
        print(f"\n\nUpdating total days and employee names for {updated_records_count} records\n\n")

    except Exception as e:
        # Handle any exceptions and print an error message
        print(f"Error: {e}")
        
import datetime

def print_creation_time():
    try:
        # Fetch all Sahayog Ticket records where status is not "Closed" or "Cancelled"
        tickets = frappe.get_all(
            "Sahayog Ticket",
            filters={"status": ["not in", ["Closed", "Cancelled"]]},
            fields=["name", "creation"]
        )

        for ticket in tickets:
            ticket_id = ticket.name
            creation_datetime = ticket.creation
            creation_time = creation_datetime.strftime("%I:%M %p")  # Format HH:MM AM/PM

            print(f"Creation Time for ticket {ticket_id}: {creation_time}")

    except Exception as e:
        # Handle any exceptions and print an error message
        print(f"Error: {e}")
