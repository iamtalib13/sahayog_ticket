import frappe

no_cache = 1


def get_context(context):
    context.boot = {
        "csrf_token": frappe.sessions.get_csrf_token(),
        "user": frappe.session.user,
    }
