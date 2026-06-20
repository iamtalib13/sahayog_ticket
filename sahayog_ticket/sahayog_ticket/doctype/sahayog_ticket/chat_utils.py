import frappe


@frappe.whitelist()
def mark_ticket_chat_seen(docname):
    """
    Mark that the current session user has seen the chat for this ticket.
    Stored in Redis cache: tchat_viewers_{docname} -> {user: last_seen_datetime}
    Expires in 30 days.
    """
    if not docname:
        return False

    if not frappe.has_permission("Sahayog Ticket", "read", docname):
        frappe.throw("Not permitted")

    user = frappe.session.user
    viewers_key = f"tchat_viewers_{docname}"

    viewers = frappe.cache().get_value(viewers_key) or {}
    viewers[user] = frappe.utils.now()
    frappe.cache().set_value(viewers_key, viewers, expires_in_sec=2592000)  # 30 days

    return True


@frappe.whitelist()
def get_ticket_chat_seen(docname):
    """
    Returns a dict of { user_email: last_seen_datetime } for this ticket's chat.
    Used by the frontend to determine WhatsApp-style tick status on messages.
    """
    if not docname:
        return {}

    if not frappe.has_permission("Sahayog Ticket", "read", docname):
        frappe.throw("Not permitted")

    viewers_key = f"tchat_viewers_{docname}"
    return frappe.cache().get_value(viewers_key) or {}
