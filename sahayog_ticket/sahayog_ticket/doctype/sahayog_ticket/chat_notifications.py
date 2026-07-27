import re
import frappe
from frappe.utils import strip_html_tags


def send_chat_notification(doc, method=None):
    """Send web push notification when new comment is added to Sahayog Ticket"""
    
    # Only for comments on Sahayog Ticket
    if doc.reference_doctype != "Sahayog Ticket":
        return
    
    # Only for Comment and Attachment types
    if doc.comment_type not in ["Comment", "Attachment"]:
        return
    
    # Get ticket details
    ticket = frappe.get_doc("Sahayog Ticket", doc.reference_name)
    
    # Find who to notify (all users who can see this ticket except the sender)
    notify_users = []
    
    # Add ticket owner
    if ticket.owner != doc.owner:
        notify_users.append(ticket.owner)
    
    # Add assigned user
    if ticket.assigned_to and ticket.assigned_to != doc.owner:
        notify_users.append(ticket.assigned_to)
    
    # Add all executives who commented (from comment history)
    comments = frappe.get_all(
        "Comment",
        filters={
            "reference_doctype": "Sahayog Ticket",
            "reference_name": doc.reference_name,
            "comment_type": ["in", ["Comment", "Attachment"]]
        },
        fields=["owner"],
        distinct=True
    )
    
    for c in comments:
        if c.owner != doc.owner and c.owner not in notify_users:
            notify_users.append(c.owner)
    
    # Send notification to each user
    for user in notify_users:
        try:
            # Get sender name
            sender = frappe.get_value("User", doc.owner, "full_name") or doc.owner
            
            # Prepare notification content
            subject = f"{sender}: {get_message_preview(doc)}"
            
            # Create Notification Log (frappe_web_push will handle browser notification)
            frappe.get_doc({
                "doctype": "Notification Log",
                "subject": subject,
                "for_user": user,
                "type": "Alert",
                "document_type": "Sahayog Ticket",
                "document_name": doc.reference_name,
                "from_user": doc.owner
            }).insert(ignore_permissions=True)
            
        except Exception as e:
            frappe.log_error(f"Failed to send chat notification: {str(e)}")


def get_message_preview(comment_doc):
    """Get short preview of message content"""
    content = comment_doc.content or ""
    
    if comment_doc.comment_type == "Attachment":
        # Extract filename from attachment
        if "<a" in content:
            match = re.search(r'>([^<]+)</a>', content)
            if match:
                return f"📎 {match.group(1)}"
        return "📎 Sent an attachment"
    
    # Strip HTML tags for text preview
    text = strip_html_tags(content).strip()
    
    # Truncate to 50 chars
    if len(text) > 50:
        return text[:47] + "..."
    
    return text or "Sent a message"
